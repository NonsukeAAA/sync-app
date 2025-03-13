/**
 * SyncApp メインアプリケーション
 * 個人用歌詞同期アプリ
 */

// アプリケーションメイン
const App = {
    songs: [],  // 登録済みの曲リスト
    
    // 初期化
    init: function() {
        // サーバーからデータを読み込み
        this.loadSongs();
        this.setupEventListeners();
        
        // 各モジュールの初期化
        UI.init();
        Editor.init();
        
        // 初期画面の表示
        navigateTo('song-list-screen');
    },
    
    // イベントリスナーのセットアップ
    setupEventListeners: function() {
        // バックボタンイベント
        window.addEventListener('popstate', () => {
            // ブラウザの戻るボタンが押されたときの処理
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                const screenId = activeScreen.id;
                
                // 現在の画面に応じて適切な画面に戻る
                if (screenId !== 'song-list-screen') {
                    history.pushState(null, null, window.location.href);
                    navigateTo('song-list-screen');
                }
            }
        });
        
        // 初期化時にhistoryを追加
        history.pushState(null, null, window.location.href);
        
        // 画面サイズ変更イベント
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 初期表示時にもサイズ調整
        this.handleResize();
    },
    
    // 画面サイズ変更時の処理
    handleResize: function() {
        // ビューポートの高さを設定
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    },
    
    // 曲データの読み込み
    loadSongs: function() {
        // サーバーからのみデータを読み込む
        apiRequest('api', 'GET', {action: 'getAllSongs'})
            .then(response => {
                if (response.success) {
                    this.songs = response.data;
                    // UI更新
                    UI.updateSongsList(this.songs);
                } else {
                    showToast('サーバーからの読み込みに失敗しました', 'error');
                }
            })
            .catch(error => {
                console.error('API error:', error);
                showToast('サーバー接続エラー。曲データを読み込めませんでした。', 'error');
            });
    },
    
    // 指定IDの曲を取得
    getSongById: function(songId) {
        return this.songs.find(song => song.id === songId) || null;
    },
    
    // 曲データの追加/更新
    saveSong: function(songData) {
        if (!songData) return false;
        
        // サーバーに保存
        return apiRequest('api', 'POST', {
            action: 'saveSong',
            song: songData
        })
        .then(response => {
            if (response.success) {
                // 既存の曲を更新するか、新しい曲を追加（メモリ上のみ）
                const existingIndex = this.songs.findIndex(song => song.id === songData.id);
                
                if (existingIndex >= 0) {
                    // 既存の曲を更新
                    this.songs[existingIndex] = songData;
                } else {
                    // 新しい曲を追加
                    this.songs.push(songData);
                }
                
                // UI更新
                UI.updateSongsList(this.songs);
                return true;
            } else {
                showToast('サーバーへの保存に失敗しました', 'error');
                return false;
            }
        })
        .catch(error => {
            console.error('API error:', error);
            showToast('サーバー接続エラー', 'error');
            return false;
        });
    },
    
    // 曲データの削除
    deleteSong: function(songId) {
        if (!songId) return false;
        
        // 削除前に確認ダイアログを表示
        if (!confirm('この曲を削除しますか？この操作は元に戻せません。')) {
            return false;
        }
        
        // サーバーから削除
        return apiRequest('api', 'DELETE', {
            action: 'deleteSong',
            id: songId
        })
        .then(response => {
            if (response && response.success) {
                // サーバー側で削除成功した場合のみ、ローカルメモリも更新
                this.songs = this.songs.filter(song => song.id !== songId);
                
                // UI更新
                UI.updateSongsList(this.songs);
                showToast('曲を削除しました', 'success');
                return true;
            } else {
                showToast('曲の削除に失敗しました', 'error');
                return false;
            }
        })
        .catch(error => {
            console.error('API error:', error);
            showToast('サーバー接続エラー。削除できませんでした。', 'error');
            return false;
        });
    },
    
    // 曲の順序を更新
    updateSongOrder: function(songIds) {
        if (!songIds || songIds.length !== this.songs.length) return false;
        
        // 順序を更新
        const orderedSongs = [];
        
        songIds.forEach(id => {
            const song = this.getSongById(id);
            if (song) {
                orderedSongs.push(song);
            }
        });
        
        // 順序付けに成功したか確認
        if (orderedSongs.length === this.songs.length) {
            this.songs = orderedSongs;
            
            // ローカルストレージに保存
            const saved = saveToLocalStorage('syncapp_songs', this.songs);
            
            if (saved) {
                return true;
            }
        }
        
        return false;
    },
    
    // サンプル曲の追加（初回利用時のみ）
    addSampleSong: function() {
        // すでに曲が登録されている場合は何もしない
        if (this.songs.length > 0) return;
        
        // さらに、サンプル曲がすでに追加されているかを確認
        if (loadFromLocalStorage('syncapp_sample_added')) return;
        
        const sampleSong = {
            id: generateUniqueId(),
            title: 'サンプル曲',
            artist: 'SyncApp',
            sourceType: 'youtube',
            sourceId: 'dQw4w9WgXcQ', // サンプル用のYouTube動画ID
            sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            lyrics: [
                {
                    id: 1,
                    text: '前奏',
                    time: 0,
                    type: 'prelude',
                    duration: 10
                },
                {
                    id: 2,
                    text: 'これはサンプル曲です',
                    time: 10,
                    type: 'normal'
                },
                {
                    id: 3,
                    text: '実際の歌詞を追加してみましょう',
                    time: 15,
                    type: 'normal'
                },
                {
                    id: 4,
                    text: '間奏',
                    time: 20,
                    type: 'interlude',
                    duration: 5
                },
                {
                    id: 5,
                    text: 'SyncAppを使ってみてください',
                    time: 25,
                    type: 'normal'
                }
            ]
        };
        
        // サンプル曲を追加
        this.saveSong(sampleSong);
        
        // サンプル曲が追加済みであることをマーク
        saveToLocalStorage('syncapp_sample_added', true);
        
        showToast('サンプル曲を追加しました', 'info');
    },
    
    // データのエクスポート
    exportData: function() {
        if (this.songs.length === 0) {
            showToast('エクスポートするデータがありません', 'error');
            return;
        }
        
        // JSON形式で出力
        const jsonData = JSON.stringify({
            songs: this.songs,
            version: '1.0.0',
            exportDate: new Date().toISOString()
        });
        
        // Blobを作成してダウンロード
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `syncapp_songs_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
        
        showToast('データをエクスポートしました', 'success');
    },
    
    // データのインポート
    importData: function(jsonData) {
        if (!jsonData) {
            showToast('インポートするデータがありません', 'error');
            return false;
        }
        
        try {
            const data = JSON.parse(jsonData);
            
            // バージョン確認や形式チェックなどを行う
            if (!data.songs || !Array.isArray(data.songs)) {
                showToast('データの形式が正しくありません', 'error');
                return false;
            }
            
            // インポート前に確認
            if (!confirm(`${data.songs.length}曲のデータをインポートします。既存のデータは上書きされます。よろしいですか？`)) {
                return false;
            }
            
            // データを上書き
            this.songs = data.songs;
            
            // ローカルストレージに保存
            const saved = saveToLocalStorage('syncapp_songs', this.songs);
            
            if (saved) {
                // UI更新
                UI.updateSongsList(this.songs);
                showToast(`${data.songs.length}曲のデータをインポートしました`, 'success');
                return true;
            } else {
                showToast('データの保存に失敗しました', 'error');
                return false;
            }
        } catch (error) {
            console.error('インポートエラー:', error);
            showToast('データの解析に失敗しました', 'error');
            return false;
        }
    }
};

// DOMContentLoaded イベントでアプリ初期化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});