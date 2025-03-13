/**
 * SyncApp ユーティリティ関数
 * 個人用歌詞同期アプリ
 */

// ユニークID生成関数
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// トースト通知表示関数
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // 指定時間後にトーストを削除
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, duration);
}

// 時間をフォーマットする関数（秒 -> MM:SS）
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return '00:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 文字列から秒数に変換する関数（MM:SS -> 秒）
function parseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return 0;
    }
    
    const parts = timeStr.split(':');
    if (parts.length !== 2) {
        return 0;
    }
    
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    
    if (isNaN(mins) || isNaN(secs)) {
        return 0;
    }
    
    return mins * 60 + secs;
}

// YouTube URLからIDを抽出する関数
function extractYouTubeId(url) {
    if (!url) return null;
    
    // 通常のYouTube URL
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    return (match && match[2].length === 11) ? match[2] : null;
}

// ニコニコ動画URLから動画IDを抽出する関数
function extractNiconicoId(url) {
    if (!url) return null;
    
    // ニコニコ動画URL (sm12345678 形式)
    const regExp = /(?:nicovideo\.jp\/watch\/|nico\.ms\/)(sm\d+)/;
    const match = url.match(regExp);
    
    return match ? match[1] : null;
}

// デバウンス関数 (連続呼び出しの制御)
function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ローカルストレージに保存する関数
function saveToLocalStorage(key, data) {
    try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);
        return true;
    } catch (error) {
        console.error('ローカルストレージへの保存に失敗しました', error);
        return false;
    }
}

// ローカルストレージから読み込む関数
function loadFromLocalStorage(key) {
    try {
        const serializedData = localStorage.getItem(key);
        if (serializedData === null) {
            return null;
        }
        return JSON.parse(serializedData);
    } catch (error) {
        console.error('ローカルストレージからの読み込みに失敗しました', error);
        return null;
    }
}

// テキストを行に分割する関数
function splitTextIntoLines(text) {
    if (!text) return [];
    
    // 改行で分割し、各行をトリム
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0); // 空行を除去
}

// ファイル名から拡張子を取得する関数
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

// APIリクエスト関数
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // ローカル開発環境用のベースURL（実際の環境に合わせて調整が必要）
        const baseUrl = '';  // 空文字の場合は相対パスになります
        
        // URLの構築（エンドポイントにaction/idパラメータを付加）
        let url = `${baseUrl}php/${endpoint}.php`;
        
        // データのコピーを作成（元のデータを変更しないため）
        let queryData = null;
        if (data) {
            queryData = {...data};
        }
        
        // GETリクエストや、必要なパラメータをURLクエリに含める
        if (method === 'GET' || method === 'DELETE') {
            if (queryData) {
                const queryParams = new URLSearchParams();
                for (const key in queryData) {
                    queryParams.append(key, queryData[key]);
                }
                url += `?${queryParams.toString()}`;
            }
        } else if ((method === 'POST' || method === 'PUT') && queryData) {
            // POSTやPUTではボディにデータを含める
            options.body = JSON.stringify(queryData);
        }
        
        // デバッグ用
        console.log(`APIリクエスト: ${method} ${url}`);
        if (options.body) {
            console.log('リクエストボディ:', options.body);
        }
        
        const response = await fetch(url, options);
        
        // レスポンスのステータスコードとコンテンツタイプをチェック
        if (!response.ok) {
            console.error(`APIエラー: ${response.status}`);
            const responseText = await response.text();
            console.error('レスポンス詳細:', responseText);
            throw new Error(`APIエラー: ${response.status} - ${responseText}`);
        }
        
        // JSONレスポンスをパース
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            // JSONでない場合はテキストとして扱う
            const text = await response.text();
            console.warn('JSONではないレスポンス:', text);
            return { success: false, message: 'JSONではないレスポンスを受信しました' };
        }
    } catch (error) {
        console.error('APIリクエストエラー:', error);
        throw error;
    }
}

// 画面遷移関数
function navigateTo(screenId) {
    // すべての画面を非表示
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // 指定された画面を表示
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // ヘッダーコンテキストを設定
    updateHeaderContext(screenId);
}

// ヘッダーコンテキスト更新関数
function updateHeaderContext(screenId) {
    const headerContext = document.getElementById('header-context');
    const backButton = document.getElementById('back-button');
    
    // スクリーンIDに応じてコンテキストとバックボタンの表示を設定
    switch (screenId) {
        case 'song-list-screen':
            headerContext.textContent = '';
            backButton.style.visibility = 'hidden';
            break;
        case 'edit-step1-screen':
            headerContext.textContent = '曲を追加';
            backButton.style.visibility = 'visible';
            break;
        case 'edit-step2-screen':
            headerContext.textContent = '歌詞編集';
            backButton.style.visibility = 'visible';
            break;
        case 'edit-step3-screen':
            headerContext.textContent = 'タイミング設定';
            backButton.style.visibility = 'visible';
            break;
        case 'playback-screen':
            headerContext.textContent = '再生中';
            backButton.style.visibility = 'visible';
            break;
        default:
            headerContext.textContent = '';
            backButton.style.visibility = 'hidden';
    }
}