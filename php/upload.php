<?php
/**
 * SyncApp ファイルアップロード処理
 * 個人用歌詞同期アプリ
 */

// 文字コード設定
header('Content-Type: application/json; charset=UTF-8');

// CORSヘッダー
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// エラーレポート設定
ini_set('display_errors', 1);
error_reporting(E_ALL);

// POSTメソッド以外は拒否
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed', null, 405);
    exit;
}

// アップロードディレクトリのパス
$uploadDir = __DIR__ . '/../uploads/';

// ディレクトリの確認・作成
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0777, true)) {
        sendResponse(false, 'Failed to create upload directory', null, 500);
        exit;
    }
}

// ファイルが送信されたか確認
if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    $errorMessage = 'No file uploaded';
    
    if (isset($_FILES['audio'])) {
        switch ($_FILES['audio']['error']) {
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                $errorMessage = 'File size exceeds limit';
                break;
            case UPLOAD_ERR_PARTIAL:
                $errorMessage = 'File was only partially uploaded';
                break;
            case UPLOAD_ERR_NO_FILE:
                $errorMessage = 'No file was uploaded';
                break;
            case UPLOAD_ERR_NO_TMP_DIR:
                $errorMessage = 'Missing temporary folder';
                break;
            case UPLOAD_ERR_CANT_WRITE:
                $errorMessage = 'Failed to write file to disk';
                break;
            case UPLOAD_ERR_EXTENSION:
                $errorMessage = 'File upload stopped by extension';
                break;
            default:
                $errorMessage = 'Unknown upload error';
        }
    }
    
    sendResponse(false, $errorMessage, null, 400);
    exit;
}

// ファイル情報を取得
$file = $_FILES['audio'];
$fileName = $file['name'];
$fileTmp = $file['tmp_name'];
$fileSize = $file['size'];
$fileType = $file['type'];

// ファイルタイプの確認
$allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav'];
if (!in_array($fileType, $allowedTypes)) {
    sendResponse(false, 'Invalid file type. Only MP3 and WAV files are allowed', null, 400);
    exit;
}

// ファイルサイズの確認（最大50MB）
$maxSize = 50 * 1024 * 1024; // 50MB
if ($fileSize > $maxSize) {
    sendResponse(false, 'File size exceeds limit (50MB)', null, 400);
    exit;
}

// ファイル名を安全に
$safeFileName = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $fileName);
$uniqueFileName = time() . '_' . $safeFileName;
$uploadPath = $uploadDir . $uniqueFileName;

// ファイルを移動
if (move_uploaded_file($fileTmp, $uploadPath)) {
    // 成功
    sendResponse(true, 'File uploaded successfully', [
        'filename' => $uniqueFileName,
        'originalName' => $fileName,
        'fileType' => $fileType,
        'fileSize' => $fileSize,
        'url' => 'uploads/' . $uniqueFileName
    ]);
} else {
    // 失敗
    sendResponse(false, 'Failed to upload file', null, 500);
}

/**
 * レスポンス送信
 */
function sendResponse($success, $message, $data = null, $statusCode = 200) {
    http_response_code($statusCode);
    
    $response = [
        'success' => $success,
        'message' => $message
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}