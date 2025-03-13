<?php
/**
 * SyncApp API
 * 個人用歌詞同期アプリ
 */

// 文字コード設定
header('Content-Type: application/json; charset=UTF-8');

// CORSヘッダー
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// エラーレポート設定
ini_set('display_errors', 1);
error_reporting(E_ALL);

// リクエストメソッド取得
$method = $_SERVER['REQUEST_METHOD'];

// リクエストパラメータ取得
$params = [];

if ($method === 'GET') {
    $params = $_GET;
} else if ($method === 'POST' || $method === 'PUT') {
    $input = file_get_contents('php://input');
    $params = json_decode($input, true);
    
    if (!$params) {
        $params = $_POST;
    }
}

// アクション取得
$action = isset($params['action']) ? $params['action'] : '';

// データファイルのパス
$dataFilePath = __DIR__ . '/../data/songs.json';

// データディレクトリとファイルの確認・作成
ensureDataFile($dataFilePath);

// リクエスト処理
switch ($method) {
    case 'GET':
        handleGetRequest($action, $params, $dataFilePath);
        break;
    case 'POST':
        handlePostRequest($action, $params, $dataFilePath);
        break;
    case 'PUT':
        handlePutRequest($action, $params, $dataFilePath);
        break;
    case 'DELETE':
        handleDeleteRequest($action, $params, $dataFilePath);
        break;
    default:
        sendResponse(false, 'Invalid request method', null, 405);
}

/**
 * GETリクエスト処理
 */
function handleGetRequest($action, $params, $dataFilePath) {
    switch ($action) {
        case 'getAllSongs':
            // すべての曲データを取得
            $songs = loadSongsData($dataFilePath);
            sendResponse(true, 'Songs retrieved successfully', $songs);
            break;
        case 'getSong':
            // 特定の曲データを取得
            if (!isset($params['id'])) {
                sendResponse(false, 'Song ID is required', null, 400);
                return;
            }
            
            $songId = $params['id'];
            $songs = loadSongsData($dataFilePath);
            
            $song = null;
            foreach ($songs as $s) {
                if ($s['id'] === $songId) {
                    $song = $s;
                    break;
                }
            }
            
            if ($song) {
                sendResponse(true, 'Song retrieved successfully', $song);
            } else {
                sendResponse(false, 'Song not found', null, 404);
            }
            break;
        default:
            sendResponse(false, 'Invalid action', null, 400);
    }
}

/**
 * POSTリクエスト処理
 */
function handlePostRequest($action, $params, $dataFilePath) {
    switch ($action) {
        case 'saveSong':
            // 曲データを保存
            if (!isset($params['song']) || !is_array($params['song'])) {
                sendResponse(false, 'Song data is required', null, 400);
                return;
            }
            
            $songData = $params['song'];
            
            // 必須項目の確認
            if (!isset($songData['id']) || !isset($songData['title']) || !isset($songData['artist'])) {
                sendResponse(false, 'Song data is incomplete', null, 400);
                return;
            }
            
            $songs = loadSongsData($dataFilePath);
            
            // 既存の曲を更新するか、新しい曲を追加
            $isUpdated = false;
            foreach ($songs as &$song) {
                if ($song['id'] === $songData['id']) {
                    $song = $songData;
                    $isUpdated = true;
                    break;
                }
            }
            
            if (!$isUpdated) {
                $songs[] = $songData;
            }
            
            // データを保存
            if (saveSongsData($dataFilePath, $songs)) {
                sendResponse(true, 'Song saved successfully', ['id' => $songData['id']]);
            } else {
                sendResponse(false, 'Failed to save song', null, 500);
            }
            break;
        case 'importData':
            // データをインポート
            if (!isset($params['data']) || !is_array($params['data'])) {
                sendResponse(false, 'Import data is required', null, 400);
                return;
            }
            
            $importData = $params['data'];
            
            // バージョン確認や形式チェックなどを行う
            if (!isset($importData['songs']) || !is_array($importData['songs'])) {
                sendResponse(false, 'Import data format is invalid', null, 400);
                return;
            }
            
            // データを保存
            if (saveSongsData($dataFilePath, $importData['songs'])) {
                sendResponse(true, 'Data imported successfully', ['count' => count($importData['songs'])]);
            } else {
                sendResponse(false, 'Failed to import data', null, 500);
            }
            break;
        default:
            sendResponse(false, 'Invalid action', null, 400);
    }
}

/**
 * PUTリクエスト処理
 */
function handlePutRequest($action, $params, $dataFilePath) {
    switch ($action) {
        case 'updateSongOrder':
            // 曲の順序を更新
            if (!isset($params['songIds']) || !is_array($params['songIds'])) {
                sendResponse(false, 'Song IDs are required', null, 400);
                return;
            }
            
            $songIds = $params['songIds'];
            $songs = loadSongsData($dataFilePath);
            
            // 順序を更新
            $orderedSongs = [];
            
            foreach ($songIds as $id) {
                foreach ($songs as $song) {
                    if ($song['id'] === $id) {
                        $orderedSongs[] = $song;
                        break;
                    }
                }
            }
            
            // 順序付けに成功したか確認
            if (count($orderedSongs) === count($songs)) {
                // データを保存
                if (saveSongsData($dataFilePath, $orderedSongs)) {
                    sendResponse(true, 'Song order updated successfully', null);
                } else {
                    sendResponse(false, 'Failed to update song order', null, 500);
                }
            } else {
                sendResponse(false, 'Invalid song IDs', null, 400);
            }
            break;
        default:
            sendResponse(false, 'Invalid action', null, 400);
    }
}

/**
 * DELETEリクエスト処理
 */
function handleDeleteRequest($action, $params, $dataFilePath) {
    switch ($action) {
        case 'deleteSong':
            // 曲データを削除
            if (!isset($params['id'])) {
                sendResponse(false, 'Song ID is required', null, 400);
                return;
            }
            
            $songId = $params['id'];
            $songs = loadSongsData($dataFilePath);
            
            // 指定されたIDの曲を削除
            $filteredSongs = [];
            $found = false;
            
            foreach ($songs as $song) {
                if ($song['id'] !== $songId) {
                    $filteredSongs[] = $song;
                } else {
                    $found = true;
                }
            }
            
            if (!$found) {
                sendResponse(false, 'Song not found', null, 404);
                return;
            }
            
            // データを保存
            if (saveSongsData($dataFilePath, $filteredSongs)) {
                sendResponse(true, 'Song deleted successfully', null);
            } else {
                sendResponse(false, 'Failed to delete song', null, 500);
            }
            break;
        default:
            sendResponse(false, 'Invalid action', null, 400);
    }
}

/**
 * 曲データをロード
 */
function loadSongsData($filePath) {
    if (!file_exists($filePath)) {
        // ファイルが存在しない場合は作成
        ensureDataFile($filePath);
        return [];
    }
    
    // ファイルの権限チェック
    if (!is_readable($filePath)) {
        // 権限を修正
        chmod($filePath, 0666);
        if (!is_readable($filePath)) {
            sendResponse(false, 'Data file is not readable', null, 500);
            exit;
        }
    }
    
    $jsonData = file_get_contents($filePath);
    
    if (!$jsonData) {
        // ファイルが空またはアクセス不能
        return [];
    }
    
    // JSONデータのデコード
    $data = json_decode($jsonData, true);
    
    if (!$data || !isset($data['songs']) || !is_array($data['songs'])) {
        // 無効なJSON形式または構造
        return [];
    }
    
    return $data['songs'];
}

/**
 * 曲データを保存
 */
function saveSongsData($filePath, $songs) {
    // データディレクトリとファイルが確実に存在するか確認
    ensureDataFile($filePath);
    
    $data = [
        'songs' => $songs,
        'version' => '1.0.0',
        'updatedAt' => date('Y-m-d H:i:s')
    ];
    
    $jsonData = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    $result = file_put_contents($filePath, $jsonData, LOCK_EX);
    
    if ($result === false) {
        error_log("Failed to write data to file: $filePath");
        return false;
    }
    
    // 書き込み権限の確認と設定
    chmod($filePath, 0666);
    
    return true;
}

/**
 * データファイルの確認・作成
 */
function ensureDataFile($filePath) {
    $dir = dirname($filePath);
    
    // ディレクトリが存在しない場合は作成
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0777, true)) {
            sendResponse(false, 'Failed to create data directory', null, 500);
            exit;
        }
    }
    
    // ディレクトリの権限も確認・設定
    chmod($dir, 0777);
    
    // ファイルが存在しない場合は作成
    if (!file_exists($filePath)) {
        $initialData = [
            'songs' => [],
            'version' => '1.0.0',
            'createdAt' => date('Y-m-d H:i:s')
        ];
        
        $jsonData = json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        if (file_put_contents($filePath, $jsonData) === false) {
            sendResponse(false, 'Failed to create data file', null, 500);
            exit;
        }
        
        // ファイルの権限も設定
        chmod($filePath, 0666);
    }
    
    // 既存ファイルの権限も確認・設定
    if (!is_writable($filePath)) {
        chmod($filePath, 0666);
        if (!is_writable($filePath)) {
            sendResponse(false, 'Data file is not writable', null, 500);
            exit;
        }
    }
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