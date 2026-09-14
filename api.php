<?php
declare(strict_types=1);

// Return JSON even when the hosting server reports a PHP fatal error.
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'خطای داخلی PHP: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
});
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'خطای PHP: ' . $e['message']], JSON_UNESCAPED_UNICODE);
    }
});

// Minimal secure JSON API foundation for cPanel PHP hosting.
// Put this file behind HTTPS and keep config.php outside public web root when possible.
// Do not let PHP warnings, BOMs, or accidental whitespace corrupt JSON responses.
ini_set('display_errors', '0');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
ob_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

$configFile = is_file(__DIR__ . '/../config.php') ? __DIR__ . '/../config.php' : __DIR__ . '/config.php';
if (!is_file($configFile)) fail('config.php یافت نشد. ابتدا config.example.php را تنظیم کنید.', 500);
$config = require $configFile;
// config.php must return an array and must not print anything.
ob_end_clean();
if (!is_array($config)) fail('فایل config.php باید یک آرایه PHP برگرداند.', 500);

try {
    $db = $config['db'];
    $pdo = new PDO(
        "mysql:host={$db['host']};dbname={$db['name']};charset={$db['charset']}",
        $db['user'], $db['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (Throwable $e) {
    fail('اتصال به دیتابیس برقرار نشد.', 500);
}

// Create the session table automatically on first request.
// This is needed because login must create a session before authentication middleware runs.
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS api_sessions (
      token CHAR(64) PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_api_sessions_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    fail('ساخت جدول نشست‌ها انجام نشد.', 500);
}

function fail(string $message, int $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
function ok(array $data = []) {
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}
function body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}
function requireMethod(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== $method) fail('متد درخواست مجاز نیست.', 405);
}
function sessionUser(PDO $pdo): array {
    $token = $_SERVER['HTTP_AUTHORIZATION'] ?? ''; if (!$token && isset($_GET['token'])) $token = 'Bearer ' . (string)$_GET['token'];
    if (!preg_match('/Bearer\s+([a-f0-9]{64})/i', $token, $m)) fail('نیاز به ورود است.', 401);
    // Session table is intentionally created here for compatibility with existing schema updates.
    $pdo->exec("CREATE TABLE IF NOT EXISTS api_sessions (
      token CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX(expires_at), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");
    $q = $pdo->prepare('SELECT u.* FROM api_sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>NOW() AND u.is_active=1');
    $q->execute([$m[1]]); $u = $q->fetch();
    if (!$u) fail('نشست منقضی شده است.', 401);
    return $u;
}
function requireRole(array $user, array $roles): void {
    if (!in_array($user['role'], $roles, true)) fail('دسترسی غیرمجاز است.', 403);
}
function logAction(PDO $pdo, ?int $uid, string $type, int $id, string $action, string $desc = ''): void {
    $q = $pdo->prepare('INSERT INTO activity_logs(user_id,entity_type,entity_id,action,description,ip_address) VALUES(?,?,?,?,?,?)');
    $q->execute([$uid, $type, $id, $action, $desc, $_SERVER['REMOTE_ADDR'] ?? null]);
}
function orderLog(PDO $pdo, int $orderId, ?int $uid, string $status, string $action, string $note=''): void {
    $q=$pdo->prepare('INSERT INTO order_logs(order_id,user_id,status,action,note) VALUES(?,?,?,?,?)'); $q->execute([$orderId,$uid,$status,$action,$note]);
}
function notify(PDO $pdo, int $uid, string $type, string $title, string $message, ?string $entityType=null, ?int $entityId=null): void {
    $q = $pdo->prepare('INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id) VALUES(?,?,?,?,?,?)');
    $q->execute([$uid,$type,$title,$message,$entityType,$entityId]);
}

$action = $_GET['action'] ?? '';
if ($action === 'challenge') {
    $types = ['add','sub','mul','max','div']; $type = $types[random_int(0, count($types)-1)];
    if ($type === 'add') { $a=random_int(2,19); $b=random_int(1,19); $question="حاصل {$a} + {$b} چیست؟"; $answer=$a+$b; }
    elseif ($type === 'sub') { $a=random_int(8,25); $b=random_int(1,$a); $question="حاصل {$a} - {$b} چیست؟"; $answer=$a-$b; }
    elseif ($type === 'mul') { $a=random_int(2,9); $b=random_int(2,9); $question="حاصل {$a} × {$b} چیست؟"; $answer=$a*$b; }
    elseif ($type === 'div') { $b=random_int(2,9); $answer=random_int(2,9); $a=$b*$answer; $question="حاصل {$a} ÷ {$b} چیست؟"; }
    else { $nums=[random_int(1,9),random_int(1,9),random_int(1,9)]; $answer=max($nums); $question='کدام عدد بزرگ‌تر است؟ ' . implode('   ',$nums); }
    $_SESSION['login_challenge']=['answer'=>(string)$answer,'expires'=>time()+300];
    ok(['question'=>$question]);
}
if ($action === 'login') {
    requireMethod('POST'); $in = body();
    $challenge = $_SESSION['login_challenge'] ?? null;
    $captcha = strtr((string)($in['captcha'] ?? ''), ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9']);
    $captcha = preg_replace('/[^0-9]/', '', $captcha);
    if (!$challenge || ($challenge['expires'] ?? 0) < time() || !hash_equals((string)$challenge['answer'], $captcha)) fail('پاسخ سؤال امنیتی صحیح نیست.', 401);
    unset($_SESSION['login_challenge']);
    $q = $pdo->prepare('SELECT u.*,s.name AS station_name,s.city AS station_city,s.guarantee_rial,s.credit_limit_percent,s.credit_score FROM users u LEFT JOIN stations s ON s.id=u.station_id WHERE u.username=? AND u.is_active=1 LIMIT 1');
    $q->execute([trim((string)($in['username'] ?? ''))]); $u = $q->fetch();
    if (!$u || !password_verify((string)($in['password'] ?? ''), $u['password_hash'])) fail('نام کاربری یا رمز عبور نادرست است.', 401);
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO api_sessions(token,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(), INTERVAL 8 HOUR))')->execute([$token,$u['id']]);
    $pdo->prepare('UPDATE users SET last_login_at=NOW() WHERE id=?')->execute([$u['id']]);
    unset($u['password_hash']); ok(['token'=>$token,'user'=>$u]);
}

$user = sessionUser($pdo);
if ($action === 'download_loading_file') { requireRole($user,['station','loading','sales','accounting','salesManager','commerce','admin']); $id=(int)($_GET['id']??0); $type=(string)($_GET['type']??''); $allowed=['waybill'=>'waybill_path','voucher'=>'voucher_path','security'=>'security_path']; if(!isset($allowed[$type]))fail('نوع فایل معتبر نیست.'); $q=$pdo->prepare('SELECT lr.* FROM loading_records lr WHERE lr.order_id=?');$q->execute([$id]);$r=$q->fetch();$path=$r[$allowed[$type]]??null;if(!$r||!$path||!is_file($path))fail('فایل پیوست پیدا نشد.',404);$mime=$r[$type.'_mime']??'application/octet-stream';header_remove('Content-Type');header('Content-Type: '.$mime);header('Content-Disposition: attachment; filename="'.basename($path).'"');readfile($path);exit; }
if ($action === 'download_settlement_receipt') { requireRole($user,['station','sales','accounting','salesManager','commerce','admin']); $id=(int)($_GET['id']??0);$q=$pdo->prepare('SELECT s.*,st.id station_id FROM settlements s JOIN stations st ON st.id=s.station_id WHERE s.id=?');$q->execute([$id]);$r=$q->fetch();if(!$r||($user['role']==='station'&&(int)$r['station_id']!==(int)$user['station_id']))fail('دسترسی یا فایل مجاز نیست.',403);if(!$r['receipt_path']||!is_file($r['receipt_path']))fail('فیش پیوست نشده است.',404);$fi=new finfo(FILEINFO_MIME_TYPE);header_remove('Content-Type');header('Content-Type: '.$fi->file($r['receipt_path']));header('Content-Disposition: inline; filename="'.basename($r['receipt_path']).'"');readfile($r['receipt_path']);exit; }
if ($action === 'change_password') {
    requireMethod('POST'); $in=body();
    $current=(string)($in['current_password']??''); $new=(string)($in['new_password']??''); $repeat=(string)($in['repeat_password']??'');
    if(strlen($new)<8) fail('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
    if($new!==$repeat) fail('تکرار رمز عبور با رمز جدید یکسان نیست.');
    $q=$pdo->prepare('SELECT password_hash FROM users WHERE id=?');$q->execute([$user['id']]);$row=$q->fetch();
    if(!$row || !password_verify($current,$row['password_hash'])) fail('رمز عبور فعلی صحیح نیست.',401);
    $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$user['id']]);
    logAction($pdo,(int)$user['id'],'user',(int)$user['id'],'change_password','کاربر رمز عبور خود را تغییر داد'); ok();
}
if ($action === 'logout') {
    requireMethod('POST'); $token = preg_replace('/^Bearer\s+/i','',$_SERVER['HTTP_AUTHORIZATION'] ?? '');
    $pdo->prepare('DELETE FROM api_sessions WHERE token=?')->execute([$token]); ok();
}
if ($action === 'notifications') {
    $q=$pdo->prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY is_read,created_at DESC LIMIT 100'); $q->execute([$user['id']]); ok(['items'=>$q->fetchAll()]);
}
if ($action === 'mark_notifications_read') {
    requireMethod('POST'); $pdo->prepare('UPDATE notifications SET is_read=1 WHERE user_id=?')->execute([$user['id']]); ok();
}
if ($action === 'dashboard') {
    $where=''; $params=[];
    if ($user['role']==='station') { $where=' WHERE station_id=?'; $params[]=$user['station_id']; }
    $orders=$pdo->prepare("SELECT status,COUNT(*) count FROM orders $where GROUP BY status"); $orders->execute($params);
    $reports=$pdo->prepare("SELECT COUNT(*) count,COALESCE(SUM(sales_liters),0) sales_liters FROM daily_reports".($user['role']==='station'?' WHERE station_id=?':'')); $reports->execute($user['role']==='station'?[$user['station_id']]:[]);
    ok(['orders_by_status'=>$orders->fetchAll(),'daily'=>$reports->fetch()]);
}
if ($action === 'commerce_dashboard') {
    requireRole($user, ['commerce','admin']);
    $loaded = $pdo->query("SELECT COALESCE(SUM(COALESCE(load_liters,liters)),0) AS liters, COALESCE(SUM(COALESCE(loaded_amount_rial,COALESCE(load_liters,liters)*unit_price_rial)),0) AS amount_rial FROM orders WHERE status='loaded'")->fetch();
    $active = $pdo->query("SELECT COUNT(*) AS count FROM stations WHERE active=1")->fetch();
    $stock = $pdo->query("SELECT COALESCE(SUM(r.closing_stock_liters),0) AS liters FROM daily_reports r JOIN (SELECT station_id,MAX(report_date) report_date FROM daily_reports GROUP BY station_id) x ON x.station_id=r.station_id AND x.report_date=r.report_date JOIN stations s ON s.id=r.station_id WHERE s.active=1")->fetch();
    $unsettled = $pdo->query("SELECT COALESCE(SUM(GREATEST(0, o.amount_rial - COALESCE(t.paid_rial,0))),0) AS amount_rial FROM (SELECT station_id,SUM(COALESCE(loaded_amount_rial,COALESCE(load_liters,liters)*unit_price_rial)) amount_rial FROM orders WHERE status='loaded' GROUP BY station_id) o LEFT JOIN (SELECT station_id,SUM(amount_rial) paid_rial FROM settlements WHERE status='approved' GROUP BY station_id) t ON t.station_id=o.station_id")->fetch();
    $recent = $pdo->query("SELECT o.id,o.order_code,o.liters,o.load_liters,o.unit_price_rial,o.loaded_amount_rial,o.loaded_at,s.name station_name,s.city FROM orders o JOIN stations s ON s.id=o.station_id WHERE o.status='loaded' ORDER BY o.loaded_at DESC,o.created_at DESC LIMIT 10")->fetchAll();
    ok(['metrics'=>['loaded_liters'=>(float)$loaded['liters'],'loaded_amount_rial'=>(int)$loaded['amount_rial'],'active_stations'=>(int)$active['count'],'remaining_stock_liters'=>(float)$stock['liters'],'unsettled_amount_rial'=>(int)$unsettled['amount_rial']], 'recent'=>$recent]);
}
if ($action === 'station_create_order') {
    requireMethod('POST'); requireRole($user, ['station']); $in=body(); $liters=(float)($in['liters']??0); $price=(int)($config['app']['price_per_liter_rial']??1300000);
    if($liters<=0)fail('مقدار سفارش باید بیشتر از صفر باشد.');
    $q=$pdo->prepare('SELECT credit_limit_rial,balance_rial FROM stations WHERE id=? AND active=1');$q->execute([$user['station_id']]);$st=$q->fetch();if(!$st)fail('جایگاه کاربر پیدا نشد.',404);$credit=max(0,(int)$st['credit_limit_rial']-(int)$st['balance_rial']);$total=(int)round($liters*$price);$overCredit=$total>$credit;
    $code='R'.strtoupper(substr(bin2hex(random_bytes(6)),0,10));$note=trim((string)($in['note']??''));if($overCredit)$note='نیاز به بررسی و اعلام کارشناس فروش — مبلغ سفارش از اعتبار باقی‌مانده بیشتر است. '.$note;$q=$pdo->prepare("INSERT INTO orders(order_code,station_id,liters,unit_price_rial,deposit_rial,status,sales_note,created_by) VALUES(?,?,?,?,0,'draft_sales',?,?)");$q->execute([$code,$user['station_id'],$liters,$price,$note,$user['id']]);$id=(int)$pdo->lastInsertId();orderLog($pdo,$id,(int)$user['id'],'draft_sales','ثبت درخواست خرید',$note);logAction($pdo,(int)$user['id'],'order',$id,'create','درخواست خرید جدید ثبت شد');ok(['id'=>$id,'order_code'=>$code,'total_rial'=>$total]);
}
if ($action === 'sales_order_detail') {
    requireRole($user, ['station','sales','accounting','salesManager','commerce','loading','admin']); $id=(int)($_GET['id']??0); $q=$pdo->prepare('SELECT o.*,s.name station_name,s.city,p.proforma_no,p.issued_at proforma_issued_at,lr.loaded_at,lr.security_approved,lr.waybill_original_name,lr.voucher_original_name,lr.security_original_name,lr.driver_rating,lr.behavior_rating,lr.safety_rating,lr.vehicle_rating,lr.punctuality_rating,lr.cleanliness_rating,lr.tanker_rating,lr.loading_note FROM orders o JOIN stations s ON s.id=o.station_id LEFT JOIN proformas p ON p.order_id=o.id LEFT JOIN loading_records lr ON lr.order_id=o.id WHERE o.id=?');$q->execute([$id]);$order=$q->fetch();if(!$order)fail('درخواست پیدا نشد.',404);if($user['role']==='station'&&(int)$order['station_id']!==(int)$user['station_id'])fail('دسترسی به این درخواست مجاز نیست.',403);$q=$pdo->prepare('SELECT l.*,u.full_name user_name FROM order_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.order_id=? ORDER BY l.created_at');$q->execute([$id]);ok(['order'=>$order,'logs'=>$q->fetchAll()]);
}
if ($action === 'sales_order_action') {
    requireMethod('POST'); requireRole($user, ['sales','accounting','salesManager','commerce','loading','admin']);
    $in=body(); $id=(int)($in['order_id']??0); $actionName=(string)($in['action']??''); $note=trim((string)($in['note']??''));
    $q=$pdo->prepare('SELECT * FROM orders WHERE id=?'); $q->execute([$id]); $o=$q->fetch(); if(!$o)fail('درخواست پیدا نشد.',404);
    $role=$user['role']; $newStatus=null; $text='';
    if($role==='sales' && $actionName==='approve' && $o['status']==='draft_sales'){$newStatus='proforma_sent';$text='تایید درخواست و صدور پیش‌فاکتور';}
    elseif($role==='sales' && $actionName==='approve' && $o['status']==='proforma_sent'){$newStatus='pending_accounting';$text='تایید اطلاعات تکمیلی و ارسال به مدیر مالی';}
    elseif($role==='accounting' && $actionName==='approve' && $o['status']==='pending_accounting'){$newStatus='pending_sales_mgr';$text='تایید مالی و ارسال به مدیر بازرگانی';}
    elseif($role==='accounting' && in_array($actionName,['reject','return'],true) && $o['status']==='pending_accounting'){$newStatus='finance_no';$text='عدم تایید مالی و عودت به کارشناس فروش';}
    elseif(in_array($role,['commerce','salesManager'],true) && $actionName==='approve' && $o['status']==='pending_sales_mgr'){$newStatus='pending_loading';$text='تایید مدیر بازرگانی و ارسال به کارشناس بارگیری';}
    elseif(in_array($role,['commerce','salesManager'],true) && in_array($actionName,['reject','return'],true) && $o['status']==='pending_sales_mgr'){$newStatus='finance_no';$text='عدم تایید مدیر بازرگانی و عودت به کارشناس فروش';}
    elseif($role==='sales' && $actionName==='return' && in_array($o['status'],['draft_sales','proforma_sent'],true)){$newStatus='returned_station';$text='عودت به جایگاه برای اصلاح';}
    elseif($role==='sales' && $actionName==='reject'){$newStatus='rejected';$text='لغو و ابطال درخواست';}
    else fail('این عملیات برای وضعیت فعلی یا نقش شما مجاز نیست.',409);
    if(in_array($actionName,['return','reject'],true)&&!$note)fail('علت عملیات را وارد کنید.');
    $pdo->beginTransaction(); try{
      $pdo->prepare('UPDATE orders SET status=?,sales_note=?,updated_at=NOW() WHERE id=?')->execute([$newStatus,$note,$id]);
      orderLog($pdo,$id,(int)$user['id'],$newStatus,$text,$note);$notifyRoles=$newStatus==='pending_accounting'?['accounting']:($newStatus==='pending_sales_mgr'?['commerce','salesManager']:($newStatus==='pending_loading'?['loading']:[]));foreach($notifyRoles as $nr){$nq=$pdo->prepare('SELECT id FROM users WHERE role=? AND is_active=1');$nq->execute([$nr]);foreach($nq->fetchAll() as $nu)notify($pdo,(int)$nu['id'],'order_workflow','ارجاع درخواست برای بررسی','درخواست '.$o['order_code'].' برای بررسی به کارتابل شما ارسال شد.','order',$id);}
      if($newStatus==='proforma_sent' && $o['status']==='draft_sales'){$no='PF-'.date('Ymd').'-'.$id;$pdo->prepare('INSERT INTO proformas(order_id,proforma_no,liters,unit_price_rial,total_rial) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE proforma_no=VALUES(proforma_no),liters=VALUES(liters),unit_price_rial=VALUES(unit_price_rial),total_rial=VALUES(total_rial)')->execute([$id,$no,$o['liters'],$o['unit_price_rial'],$o['liters']*$o['unit_price_rial']]);}
      $pdo->commit(); ok(['status'=>$newStatus]);
    }catch(Throwable $e){$pdo->rollBack();fail('عملیات انجام نشد.',500);}
}
if ($action === 'sales_inbox') {
    requireRole($user, ['sales','accounting','salesManager','commerce','loading','admin']);
    $where="o.status NOT IN ('loaded','rejected','cancelled')"; if($user['role']==='sales') $where="o.status NOT IN ('rejected','cancelled')"; elseif($user['role']==='accounting') $where="o.status NOT IN ('rejected','cancelled')"; elseif(in_array($user['role'],['commerce','salesManager'],true)) $where="o.status NOT IN ('rejected','cancelled','loaded')"; elseif($user['role']==='loading') $where="o.status IN ('pending_loading','loaded')";
    $q=$pdo->query("SELECT o.id,o.order_code,o.liters,o.unit_price_rial,(o.liters*o.unit_price_rial) total_rial,o.status,o.created_at,o.updated_at,s.name station_name,s.city FROM orders o JOIN stations s ON s.id=o.station_id WHERE $where ORDER BY o.created_at DESC");
    ok(['orders'=>$q->fetchAll()]);
}
if ($action === 'station_order_resubmit') {
    requireMethod('POST'); requireRole($user, ['station']); $id=(int)($_POST['order_id']??0); $driver=trim((string)($_POST['driver_name']??'')); $plate=trim((string)($_POST['vehicle_plate']??'')); $national=trim((string)($_POST['driver_national_id']??'')); $vehicle=trim((string)($_POST['vehicle_type']??'')); $amount=(int)($_POST['payment_amount_rial']??0); if(!$id||!$driver||!$plate||!preg_match('/^\d{10}$/',$national)||!$vehicle)fail('نام راننده، پلاک، کد ملی ۱۰ رقمی و نوع ماشین الزامی است.');$q=$pdo->prepare("SELECT id FROM orders WHERE id=? AND station_id=? AND status IN ('proforma_sent','returned_station')");$q->execute([$id,$user['station_id']]);if(!$q->fetch())fail('این درخواست برای تکمیل اطلاعات آماده نیست.',409);$receipt=null;if(isset($_FILES['receipt'])&&$_FILES['receipt']['error']===UPLOAD_ERR_OK){if($_FILES['receipt']['size']>1024*1024)fail('حجم رسید بیشتر از ۱ مگابایت است.');$fi=new finfo(FILEINFO_MIME_TYPE);$mime=$fi->file($_FILES['receipt']['tmp_name']);if(!in_array($mime,['application/pdf','image/jpeg'],true))fail('رسید فقط PDF یا JPG باشد.');$dir=$config['app']['upload_dir'];if(!is_dir($dir))mkdir($dir,0750,true);$name=bin2hex(random_bytes(16));$path=rtrim($dir,'/').'/'.$name;move_uploaded_file($_FILES['receipt']['tmp_name'],$path);$receipt=[$_FILES['receipt']['name'],$path,$mime,(int)$_FILES['receipt']['size']];}$pdo->beginTransaction();try{$pdo->prepare("UPDATE orders SET driver_name=?,driver_national_id=?,vehicle_plate=?,vehicle_type=?,payment_amount_rial=?,payment_status=?,payment_receipt_name=?,payment_receipt_path=?,payment_receipt_mime=?,payment_receipt_size_bytes=?,status='proforma_sent',station_note=?,station_resubmitted_at=NOW(),updated_at=NOW() WHERE id=?")->execute([$driver,$national,$plate,$vehicle,$amount,$amount>0?'submitted':'pending',$receipt[0]??null,$receipt[1]??null,$receipt[2]??null,$receipt[3]??null,trim((string)($_POST['note']??'')),$id]);orderLog($pdo,$id,(int)$user['id'],'proforma_sent','ثبت اطلاعات راننده و ارسال مجدد به کارشناس فروش',trim((string)($_POST['note']??'')));$pdo->commit();ok();}catch(Throwable $e){$pdo->rollBack();fail('ارسال اطلاعات انجام نشد.',500);}
}
if ($action === 'station_order_detail') {
    requireRole($user, ['station']); $id=(int)($_GET['id']??0); $q=$pdo->prepare('SELECT o.*,s.name station_name,s.city FROM orders o JOIN stations s ON s.id=o.station_id WHERE o.id=? AND o.station_id=?');$q->execute([$id,$user['station_id']]);$order=$q->fetch();if(!$order)fail('درخواست پیدا نشد.',404);$q=$pdo->prepare('SELECT l.*,u.full_name user_name FROM order_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.order_id=? ORDER BY l.created_at');$q->execute([$id]);ok(['order'=>$order,'logs'=>$q->fetchAll()]);
}
if ($action === 'station_history') {
    requireRole($user, ['station']); $q=$pdo->prepare("SELECT o.id,o.order_code,o.liters,o.unit_price_rial,(o.liters*o.unit_price_rial) total_rial,o.status,o.created_at,o.updated_at FROM orders o WHERE o.station_id=? ORDER BY o.created_at DESC");$q->execute([$user['station_id']]);ok(['orders'=>$q->fetchAll()]);
}
function settlementLog(PDO $pdo,int $sid,?int $uid,string $status,string $action,string $note=''):void{$q=$pdo->prepare('INSERT INTO settlement_logs(settlement_id,user_id,status,action,note) VALUES(?,?,?,?,?)');$q->execute([$sid,$uid,$status,$action,$note]);}
if($action==='settlement_create'){requireMethod('POST');requireRole($user,['station']);$liters=(float)($_POST['sales_liters']??0);$amount=(int)($_POST['amount_rial']??0);$date=(string)($_POST['paid_on']??'');if($liters<=0||$amount<=0||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))fail('اطلاعات تسویه معتبر نیست.');$file=null;if(isset($_FILES['receipt'])&&$_FILES['receipt']['error']===UPLOAD_ERR_OK){$dir=$config['app']['upload_dir'];if(!is_dir($dir))mkdir($dir,0750,true);$fi=new finfo(FILEINFO_MIME_TYPE);$mime=$fi->file($_FILES['receipt']['tmp_name']);if(!in_array($mime,['application/pdf','image/jpeg','image/png'],true))fail('فیش باید PDF یا تصویر باشد.');$name=bin2hex(random_bytes(16));$path=rtrim($dir,'/').'/'.$name;move_uploaded_file($_FILES['receipt']['tmp_name'],$path);$file=[$path,$_FILES['receipt']['name']];}$code='S'.date('ymdHis').random_int(10,99);$q=$pdo->prepare('INSERT INTO settlements(settlement_code,station_id,sales_liters,amount_rial,paid_on,status,note,receipt_path,created_by) VALUES(?,?,?,?,?,?,?,?,?)');$q->execute([$code,$user['station_id'],$liters,$amount,$date,'pending_sales',trim((string)($_POST['note']??'')),$file[0]??null,$user['id']]);$id=(int)$pdo->lastInsertId();settlementLog($pdo,$id,(int)$user['id'],'pending_sales','ثبت فرم تسویه فروش',trim((string)($_POST['note']??'')));$n=$pdo->query("SELECT id FROM users WHERE role='sales' AND is_active=1");foreach($n->fetchAll() as $r)notify($pdo,(int)$r['id'],'settlement_new','تسویه جدید جایگاه','یک فرم تسویه جدید برای بررسی ارسال شده است.','settlement',$id);ok(['id'=>$id,'settlement_code'=>$code]);}
if($action==='settlement_list'){requireRole($user,['station','sales','accounting','commerce','salesManager','admin']);$where='';$p=[];if($user['role']==='station'){$where=' WHERE s.station_id=?';$p[]=$user['station_id'];}elseif($user['role']==='sales')$where=" WHERE s.status IN ('pending_sales','returned_station','pending_finance')";elseif($user['role']==='accounting')$where=" WHERE s.status='pending_finance'";elseif(in_array($user['role'],['commerce','salesManager'],true))$where=" WHERE s.status IN ('approved')";$q=$pdo->prepare("SELECT s.*,st.name station_name,st.city FROM settlements s JOIN stations st ON st.id=s.station_id $where ORDER BY s.created_at DESC");$q->execute($p);ok(['items'=>$q->fetchAll()]);}
if($action==='settlement_detail'){requireRole($user,['station','sales','accounting','commerce','salesManager','admin']);$id=(int)($_GET['id']??0);$q=$pdo->prepare('SELECT s.*,st.name station_name,st.city FROM settlements s JOIN stations st ON st.id=s.station_id WHERE s.id=?');$q->execute([$id]);$x=$q->fetch();if(!$x)fail('فرم تسویه پیدا نشد.',404);if($user['role']==='station'&&(int)$x['station_id']!==(int)$user['station_id'])fail('دسترسی مجاز نیست.',403);$q=$pdo->prepare('SELECT l.*,u.full_name user_name FROM settlement_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.settlement_id=? ORDER BY l.created_at');$q->execute([$id]);ok(['settlement'=>$x,'logs'=>$q->fetchAll()]);}
if($action==='settlement_action'){requireMethod('POST');requireRole($user,['sales','accounting','admin']);$in=body();$id=(int)($in['settlement_id']??0);$act=(string)($in['action']??'');$note=trim((string)($in['note']??''));$q=$pdo->prepare('SELECT * FROM settlements WHERE id=?');$q->execute([$id]);$x=$q->fetch();if(!$x)fail('فرم تسویه پیدا نشد.',404);$new=null;$text='';if($user['role']==='sales'&&$act==='return'&&in_array($x['status'],['pending_sales','returned_station'],true)){$new='returned_station';$text='عودت به جایگاه برای اصلاح';}elseif($user['role']==='sales'&&$act==='approve'&&in_array($x['status'],['pending_sales','returned_station'],true)){$new='pending_finance';$text='ارسال به مدیر مالی برای تأیید واریز';}elseif($user['role']==='sales'&&$act==='reject'){$new='rejected';$text='رد فرم تسویه';}elseif($user['role']==='accounting'&&$act==='return'&&$x['status']==='pending_finance'){$new='returned_station';$text='بازگشت برای اصلاح یا پیگیری';}elseif($user['role']==='accounting'&&$act==='approve'&&$x['status']==='pending_finance'){$new='approved';$text='تأیید مالی و ارسال نتیجه';}elseif($user['role']==='accounting'&&$act==='reject'&&$x['status']==='pending_finance'){$new='rejected';$text='عدم تأیید و بسته‌شدن فرم';}else fail('عملیات برای وضعیت فعلی مجاز نیست.',409);if(in_array($act,['return','reject'],true)&&!$note)fail('توضیحات عملیات الزامی است.');$pdo->beginTransaction();try{$pdo->prepare('UPDATE settlements SET status=?,note=?,approved_by=?,approved_at=CASE WHEN ?="approved" THEN NOW() ELSE approved_at END,updated_at=NOW() WHERE id=?')->execute([$new,$note,$new==='approved'?$user['id']:null,$new,$id]);if($new==='approved'){$st=$pdo->prepare('SELECT balance_rial,total_sales_liters,total_received_rial FROM stations WHERE id=? FOR UPDATE');$st->execute([$x['station_id']]);$before=$st->fetch();$salesAmount=0;$paid=(int)$x['amount_rial'];$balanceBefore=(int)($before['balance_rial']??0);$balanceAfter=$balanceBefore+$salesAmount-$paid;$pdo->prepare('INSERT INTO station_financial_ledger(station_id,settlement_id,sales_liters,sales_amount_rial,paid_amount_rial,balance_before_rial,balance_after_rial,transaction_type,approved_by) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$x['station_id'],$id,$x['sales_liters'],$salesAmount,$paid,$balanceBefore,$balanceAfter,'settlement_approved',$user['id']]);$pdo->prepare('UPDATE stations SET total_sales_liters=COALESCE(total_sales_liters,0)+?,total_received_rial=COALESCE(total_received_rial,0)+?,balance_rial=?,last_sale_date=?,last_received_date=?,financial_updated_by=?,financial_updated_at=NOW() WHERE id=?')->execute([$x['sales_liters'],$paid,$balanceAfter,$x['paid_on'],$x['paid_on'],$user['id'],$x['station_id']]);}settlementLog($pdo,$id,(int)$user['id'],$new,$text,$note);$roles=$new==='pending_finance'?['accounting']:($new==='approved'?['station','sales','commerce','salesManager']:($new==='returned_station'?['station','sales']:[]));foreach($roles as $role){$q=$pdo->prepare('SELECT id FROM users WHERE role=? AND is_active=1'.($role==='station'?' AND station_id=?':''));$q->execute($role==='station'?[$role,$x['station_id']]:[$role]);foreach($q->fetchAll() as $r)notify($pdo,(int)$r['id'],'settlement','گردش فرم تسویه','فرم تسویه '.$x['settlement_code'].' به مرحله جدید ارسال شد.','settlement',$id);}$pdo->commit();ok(['status'=>$new]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail('ثبت عملیات تسویه انجام نشد: '.$e->getMessage(),500);}}
if ($action === 'daily_report') {
    requireMethod('POST'); requireRole($user,['station','admin']); $in=body();
    $station=(int)($user['role']==='station'?$user['station_id']:($in['station_id']??0));
    $date=(string)($in['report_date']??''); $open=(float)($in['opening_stock_liters']??-1); $sales=(float)($in['sales_liters']??-1); $close=(float)($in['closing_stock_liters']??-1);
    if(!$station || !preg_match('/^\d{4}-\d{2}-\d{2}$/',$date) || $open<0 || $sales<0 || $close<0) fail('اطلاعات گزارش روزانه معتبر نیست.');
    $q=$pdo->prepare('INSERT INTO daily_reports(station_id,report_date,opening_stock_liters,sales_liters,closing_stock_liters,note,created_by) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE opening_stock_liters=VALUES(opening_stock_liters),sales_liters=VALUES(sales_liters),closing_stock_liters=VALUES(closing_stock_liters),note=VALUES(note),updated_at=NOW()');
    $q->execute([$station,$date,$open,$sales,$close,trim((string)($in['note']??'')),$user['id']]); logAction($pdo,(int)$user['id'],'daily_report',0,'upsert','گزارش روزانه ثبت/ویرایش شد'); ok();
}
if ($action === 'daily_reports') {
    $station=$user['role']==='station'?(int)$user['station_id']:(int)($_GET['station_id']??0); $from=$_GET['from']??'1000-01-01'; $to=$_GET['to']??'9999-12-31';
    $sql='SELECT r.*,s.name station_name FROM daily_reports r JOIN stations s ON s.id=r.station_id WHERE r.report_date BETWEEN ? AND ?'; $p=[$from,$to];
    if($station){$sql.=' AND r.station_id=?';$p[]=$station;} $sql.=' ORDER BY r.report_date DESC'; $q=$pdo->prepare($sql);$q->execute($p);ok(['items'=>$q->fetchAll()]);
}
if ($action === 'pending_work') {
    requireRole($user,['sales','accounting','salesManager','commerce','loading','admin']);
    $map=['sales'=>['draft_sales','proforma_sent','finance_ok','finance_no'],'accounting'=>['pending_accounting'],'salesManager'=>['pending_sales_mgr'],'loading'=>['pending_loading'],'commerce'=>[],'admin'=>[]];
    $statuses=$map[$user['role']]??[]; $sql='SELECT o.*,s.name station_name FROM orders o JOIN stations s ON s.id=o.station_id'; $p=[];
    if($statuses){$sql.=' WHERE o.status IN ('.implode(',',array_fill(0,count($statuses),'?')).')';$p=$statuses;} $sql.=' ORDER BY o.created_at DESC';$q=$pdo->prepare($sql);$q->execute($p);ok(['items'=>$q->fetchAll()]);
}
if ($action === 'stations') {
    requireRole($user, ['admin']);
    $q = $pdo->query('SELECT id,code,name,city FROM stations WHERE active=1 ORDER BY name');
    ok(['items' => $q->fetchAll()]);
}
if ($action === 'loading_save') {
    requireMethod('POST'); requireRole($user, ['loading','admin']);
    $orderId=(int)($_POST['order_id']??0); $loadedAt=(string)($_POST['loaded_at']??''); $driverRating=(int)($_POST['driver_rating']??0); $tankerRating=(int)($_POST['tanker_rating']??0); $behavior=(int)($_POST['behavior_rating']??0); $safety=(int)($_POST['safety_rating']??0); $vehicle=(int)($_POST['vehicle_rating']??0); $punctuality=(int)($_POST['punctuality_rating']??0); $cleanliness=(int)($_POST['cleanliness_rating']??0); $securityApproved=(int)($_POST['security_approved']??0);
    if(!$orderId || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/',$loadedAt) || $driverRating<1 || $driverRating>5 || $tankerRating<1 || $tankerRating>5) fail('اطلاعات بارگیری معتبر نیست.');
    $q=$pdo->prepare("SELECT id,station_id FROM orders WHERE id=? AND status='pending_loading'");$q->execute([$orderId]);$targetOrder=$q->fetch();if(!$targetOrder)fail('این سفارش برای بارگیری آماده نیست.',409);
    $dir=$config['app']['upload_dir']; if(!is_dir($dir) && !mkdir($dir,0750,true))fail('پوشه آپلود قابل ایجاد نیست.',500);
    $saveUpload=function(string $key) use ($config,$dir){ if(!isset($_FILES[$key]) || $_FILES[$key]['error']===UPLOAD_ERR_NO_FILE) return [null,null,null,0]; if($_FILES[$key]['error']!==UPLOAD_ERR_OK) fail('خطا در دریافت فایل پیوست.'.'.'); $f=$_FILES[$key]; if($f['size']>1024*1024) fail('حجم هر فایل نباید بیشتر از ۱ مگابایت باشد.'); $fi=new finfo(FILEINFO_MIME_TYPE); $mime=$fi->file($f['tmp_name']); $allowed=['application/pdf'=>'pdf','image/jpeg'=>'jpg']; if(!isset($allowed[$mime]))fail('فرمت فایل فقط PDF یا JPG/JPEG مجاز است.'); $name=bin2hex(random_bytes(16)).'.'.$allowed[$mime];$path=rtrim($dir,'/').'/'.$name;if(!move_uploaded_file($f['tmp_name'],$path))fail('ذخیره فایل انجام نشد.',500);return [$f['name'],$path,$mime,(int)$f['size']]; };
    [$wn,$wp,$wm,$ws]=$saveUpload('waybill'); [$vn,$vp,$vm,$vs]=$saveUpload('voucher'); [$sn,$sp,$sm,$ss]=$saveUpload('security');
    $pdo->beginTransaction(); try { $q=$pdo->prepare('INSERT INTO loading_records(order_id,waybill_original_name,waybill_path,waybill_mime,waybill_size_bytes,voucher_original_name,voucher_path,voucher_mime,voucher_size_bytes,loaded_at,security_approved,security_original_name,security_path,security_mime,security_size_bytes,driver_rating,behavior_rating,safety_rating,vehicle_rating,punctuality_rating,cleanliness_rating,tanker_rating,loading_note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');$q->execute([$orderId,$wn,$wp,$wm,$ws,$vn,$vp,$vm,$vs,str_replace('T',' ',$loadedAt).':00',$securityApproved,$sn,$sp,$sm,$ss,$driverRating,$behavior,$safety,$vehicle,$punctuality,$cleanliness,$tankerRating,trim((string)($_POST['loading_note']??'')),(int)$user['id']]);$pdo->prepare("UPDATE orders SET status='loaded',loaded_at=?,load_liters=liters,loaded_amount_rial=liters*unit_price_rial WHERE id=?")->execute([str_replace('T',' ',$loadedAt).':00',$orderId]);$pay=$pdo->prepare('SELECT station_id,liters,unit_price_rial,payment_amount_rial FROM orders WHERE id=?');$pay->execute([$orderId]);$financial=$pay->fetch();$pdo->prepare("UPDATE stations SET total_sales_liters=COALESCE(total_sales_liters,0)+?,total_received_rial=COALESCE(total_received_rial,0)+?,balance_rial=COALESCE(balance_rial,0)+(?*?)-?,last_sale_date=CURDATE(),last_received_date=CASE WHEN ?>0 THEN CURDATE() ELSE last_received_date END,financial_updated_at=NOW() WHERE id=?")->execute([(float)$financial['liters'],(int)$financial['payment_amount_rial'],(float)$financial['liters'],(int)$financial['unit_price_rial'],(int)$financial['payment_amount_rial'],(int)$financial['payment_amount_rial'],(int)$financial['station_id']]);logAction($pdo,(int)$user['id'],'order',$orderId,'loaded','بارگیری، بارنامه، حواله و ارزیابی ثبت شد');$n=$pdo->prepare("SELECT id FROM users WHERE is_active=1 AND (role IN ('sales','accounting','salesManager','commerce') OR (role='station' AND station_id=?))");$n->execute([(int)$targetOrder['station_id']]);foreach($n->fetchAll() as $recipient){notify($pdo,(int)$recipient['id'],'order_loaded','تکمیل بارگیری سفارش','بارگیری سفارش تکمیل شد و برای مشاهده در کارتابل ثبت گردید.','order',$orderId);}$pdo->commit();ok(); } catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); if($wp) @unlink($wp); if($vp) @unlink($vp); if($sp) @unlink($sp); fail('ثبت اطلاعات بارگیری انجام نشد: '.$e->getMessage(),500); }
}
if ($action === 'loading_list') {
    requireRole($user, ['loading','admin']); $q=$pdo->query("SELECT o.id,o.order_code,o.liters,o.driver_name,o.vehicle_plate,o.vehicle_description,s.name station_name,s.city,lr.loaded_at,lr.driver_rating,lr.tanker_rating,lr.waybill_original_name,lr.voucher_original_name FROM orders o JOIN stations s ON s.id=o.station_id LEFT JOIN loading_records lr ON lr.order_id=o.id WHERE o.status IN ('pending_loading','loaded') ORDER BY o.created_at DESC"); ok(['items'=>$q->fetchAll()]);
}
if ($action === 'station_finance_list') {
    requireRole($user, ['sales','admin']);
    $q = $pdo->query("SELECT s.id,s.code,s.name,s.city,s.contract_start,s.contract_end,s.guarantee_rial,s.credit_limit_percent,s.credit_score,s.financial_status,s.settled_rial,s.last_settlement_date,s.*,
                      ((COALESCE(s.credit_limit_rial,0) + COALESCE(s.total_received_rial,0)) - COALESCE(s.total_sales_liters,0)) AS remaining_credit_rial,
                      u.full_name AS updated_by_name,
                      (SELECT su.full_name FROM users su WHERE su.station_id=s.id AND su.role='station' ORDER BY su.id LIMIT 1) AS station_display_name
                      FROM stations s LEFT JOIN users u ON u.id=s.financial_updated_by WHERE s.active=1 ORDER BY COALESCE(station_display_name,s.name)");
    ok(['items' => $q->fetchAll()]);
}
if ($action === 'station_finance_update') {
    requireMethod('POST'); requireRole($user, ['sales','admin']); $in=body();
    $id=(int)($in['station_id']??0); $status=(string)($in['financial_status']??'review');
    $allowed=['healthy','due','overdue','blocked','review'];
    if(!$id || !in_array($status,$allowed,true)) fail('اطلاعات مالی جایگاه معتبر نیست.');
    $q=$pdo->prepare('SELECT id FROM stations WHERE id=? AND active=1');$q->execute([$id]);if(!$q->fetch())fail('جایگاه پیدا نشد.',404);
    $q=$pdo->prepare('UPDATE stations SET contract_no=?,owner_name=?,contract_start=?,contract_end=?,annex_end_date=?,contract_type=?,credit_check=?,credit_check_amount_rial=?,credit_limit_rial=?,commission_percent=?,credit_status=?,last_settlement_date=?,last_sale_date=?,last_received_date=?,balance_rial=?,total_sales_liters=?,total_received_rial=?,sales_note=?,financial_status=?,financial_updated_by=?,financial_updated_at=NOW() WHERE id=?');
    $q->execute([(string)($in['contract_no']??''),trim((string)($in['owner_name']??'')),($in['contract_start']??null)?:null,($in['contract_end']??null)?:null,($in['annex_end_date']??null)?:null,in_array(($in['contract_type']??'credit'),['cash','credit'],true)?$in['contract_type']:'credit',(int)($in['credit_check']??0),(int)($in['credit_check_amount_rial']??0),(int)($in['credit_limit_rial']??0),(float)($in['commission_percent']??0),in_array(($in['credit_status']??'review'),['gold','silver','red','review'],true)?$in['credit_status']:'review',($in['last_settlement_date']??null)?:null,($in['last_sale_date']??null)?:null,($in['last_received_date']??null)?:null,(int)($in['balance_rial']??0),(float)($in['total_sales_liters']??0),(int)($in['total_received_rial']??0),trim((string)($in['sales_note']??'')),$status,(int)$user['id'],$id]);
    logAction($pdo,(int)$user['id'],'station',$id,'finance_update','اطلاعات مالی جایگاه به‌روزرسانی شد'); ok();
}
if ($action === 'station_profile') {
    $id=$user['role']==='station'?(int)$user['station_id']:(int)($_GET['station_id']??0); if(!$id)fail('جایگاه مشخص نشده است.');
    $q=$pdo->prepare('SELECT s.*, ((COALESCE(s.credit_limit_rial,0) + COALESCE(s.total_received_rial,0)) - COALESCE(s.total_sales_liters,0)) AS remaining_credit_rial FROM stations s WHERE s.id=? AND s.active=1');$q->execute([$id]);$s=$q->fetch();if(!$s)fail('جایگاه پیدا نشد.',404);ok(['station'=>$s]);
}
if ($action === 'users') {
    requireRole($user, ['admin']);
    $q = $pdo->query("SELECT u.id,u.username,u.full_name,u.role,u.station_id,u.is_active,u.last_login_at,u.created_at,s.name AS station_name,s.city AS station_city
                      FROM users u LEFT JOIN stations s ON s.id=u.station_id ORDER BY u.created_at DESC");
    ok(['items' => $q->fetchAll()]);
}
if ($action === 'user_create') {
    requireMethod('POST'); requireRole($user, ['admin']); $in = body();
    $username = trim((string)($in['username'] ?? ''));
    $fullName = trim((string)($in['full_name'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $role = (string)($in['role'] ?? '');
    $stationId = !empty($in['station_id']) ? (int)$in['station_id'] : null;
    $city = trim((string)($in['city'] ?? ''));
    $roles = ['station','sales','accounting','salesManager','commerce','loading','admin'];
    if (!preg_match('/^[A-Za-z0-9_.-]{3,80}$/', $username)) fail('نام کاربری باید حداقل ۳ حرف و فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.');
    if ($fullName === '' || mb_strlen($fullName) > 160) fail('نام کامل کاربر معتبر نیست.');
    if (strlen($password) < 8) fail('رمز عبور باید حداقل ۸ کاراکتر باشد.');
    if (!in_array($role, $roles, true)) fail('نقش کاربر معتبر نیست.');
    if ($role === 'station') {
        if ($city === '' && !$stationId) fail('برای کاربر جایگاه‌دار، انتخاب شهر الزامی است.');
        if ($city !== '') {
            $find = $pdo->prepare('SELECT id FROM stations WHERE city=? AND active=1 LIMIT 1'); $find->execute([$city]);
            $stationId = (int)($find->fetchColumn() ?: 0);
            if (!$stationId) {
                $code = 'ST' . strtoupper(bin2hex(random_bytes(3)));
                $new = $pdo->prepare("INSERT INTO stations(code,name,city,contract_start,guarantee_rial,credit_limit_percent,credit_score) VALUES(?,?,?,CURDATE(),0,50,'silver')");
                $new->execute([$code, 'جایگاه ' . $city, $city]); $stationId = (int)$pdo->lastInsertId();
            }
        }
        $check = $pdo->prepare('SELECT id FROM stations WHERE id=? AND active=1'); $check->execute([$stationId]);
        if (!$check->fetch()) fail('شهر/جایگاه انتخاب‌شده معتبر نیست.');
    } else $stationId = null;
    try {
        $q = $pdo->prepare('INSERT INTO users(username,password_hash,full_name,role,station_id,is_active) VALUES(?,?,?,?,?,1)');
        $q->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $role, $stationId]);
        $id = (int)$pdo->lastInsertId(); logAction($pdo, (int)$user['id'], 'user', $id, 'create', 'کاربر جدید ایجاد شد');
        ok(['id' => $id]);
    } catch (PDOException $e) {
        if ((int)$e->errorInfo[1] === 1062) fail('این نام کاربری قبلاً استفاده شده است.');
        fail('ایجاد کاربر انجام نشد.', 500);
    }
}
if ($action === 'user_update') {
    requireMethod('POST'); requireRole($user, ['admin']); $in = body();
    $id = (int)($in['id'] ?? 0); $target = $pdo->prepare('SELECT * FROM users WHERE id=?'); $target->execute([$id]); $old = $target->fetch();
    if (!$old) fail('کاربر پیدا نشد.', 404);
    $fullName = trim((string)($in['full_name'] ?? $old['full_name'])); $role = (string)($in['role'] ?? $old['role']);
    $stationId = !empty($in['station_id']) ? (int)$in['station_id'] : null; $city = trim((string)($in['city'] ?? '')); $password = (string)($in['password'] ?? '');
    $roles = ['station','sales','accounting','salesManager','commerce','loading','admin'];
    if ($fullName === '' || !in_array($role, $roles, true)) fail('اطلاعات کاربر معتبر نیست.');
    if ($password !== '' && strlen($password) < 8) fail('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
    if ($role === 'station') {
        if ($city === '' && !$stationId) fail('برای کاربر جایگاه‌دار، انتخاب شهر الزامی است.');
        if ($city !== '') {
            $find = $pdo->prepare('SELECT id FROM stations WHERE city=? AND active=1 LIMIT 1'); $find->execute([$city]);
            $stationId = (int)($find->fetchColumn() ?: 0);
            if (!$stationId) {
                $code = 'ST' . strtoupper(bin2hex(random_bytes(3)));
                $new = $pdo->prepare("INSERT INTO stations(code,name,city,contract_start,guarantee_rial,credit_limit_percent,credit_score) VALUES(?,?,?,CURDATE(),0,50,'silver')");
                $new->execute([$code, 'جایگاه ' . $city, $city]); $stationId = (int)$pdo->lastInsertId();
            }
        }
        $check = $pdo->prepare('SELECT id FROM stations WHERE id=? AND active=1'); $check->execute([$stationId]);
        if (!$check->fetch()) fail('شهر/جایگاه انتخاب‌شده معتبر نیست.');
    } else $stationId = null;
    if ($password !== '') {
        $q = $pdo->prepare('UPDATE users SET full_name=?,role=?,station_id=?,password_hash=? WHERE id=?');
        $q->execute([$fullName,$role,$stationId,password_hash($password,PASSWORD_DEFAULT),$id]);
    } else {
        $q = $pdo->prepare('UPDATE users SET full_name=?,role=?,station_id=? WHERE id=?');
        $q->execute([$fullName,$role,$stationId,$id]);
    }
    logAction($pdo, (int)$user['id'], 'user', $id, 'update', 'اطلاعات کاربر ویرایش شد'); ok();
}
if ($action === 'user_toggle') {
    requireMethod('POST'); requireRole($user, ['admin']); $id=(int)(body()['id']??0);
    if ($id === (int)$user['id']) fail('مدیر سامانه نمی‌تواند حساب خودش را غیرفعال کند.');
    $q=$pdo->prepare('UPDATE users SET is_active=1-is_active WHERE id=?'); $q->execute([$id]);
    if ($q->rowCount() < 1) fail('کاربر پیدا نشد.',404);
    logAction($pdo,(int)$user['id'],'user',$id,'toggle','وضعیت فعال/غیرفعال کاربر تغییر کرد'); ok();
}
fail('عملیات ناشناخته است.', 404);
