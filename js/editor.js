/**
 * SyncApp エディターモジュール
 * 個人用歌詞同期アプリ
 */

// エディターを管理するオブジェクト
const Editor = {
    currentSong: null,      // 現在編集中の曲データ
    isEditing: false,       // 編集中かどうか
    isSyncMode: false,      // 同期モードかどうか
    uploadedFile: null,     // アップロードされたファイル
    
    // 初期化
    init: function() {
        this.setupEventListeners();
    },
    
    // イベントリスナーのセットアップ
    setupEventListeners: function() {
        // タイミング設定ボタンのイベント委譲
        const lyricsTimingList = document.getElementById('lyrics-timing-list');
        if (lyricsTimingList) {
            lyricsTimingList.addEventListener('click', (e) => {
                const button = e.target.closest('.lyrics-timing-button');
                if (button) {
                    const index = parseInt(button.dataset.index, 10);
                    this.setTimingForLine(index);
                }
            });
        }
        
        // ローカルファイル選択時の処理
        document.addEventListener('change', (e) => {
            if (e.target.id === 'source-file') {
                this.handleFileSelection(e.target.files);
            }
        });
    },
    
    // エディターをリセット
    resetEditor: function() {
        // 新しい曲データのテンプレートを作成
        this.currentSong = {
            id: generateUniqueId(),
            title: '',
            artist: '',
            sourceType: 'youtube',
            sourceId: '',
            sourceUrl: '',
            lyrics: []
        };
        
        this.isEditing = true;
        this.isSyncMode = false;
        this.uploadedFile = null;
        
        // フォームをリセット
        document.getElementById('song-title').value = '';
        document.getElementById('song-artist').value = '';
        document.getElementById('lyrics-text').value = '';
        
        // 音源タイプセレクターをリセット
        document.querySelectorAll('.source-type-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector('.source-type-button[data-type="youtube"]').classList.add('active');
        
        // 音源入力フィールドをリセット
        document.getElementById('source-input-container').innerHTML = `
            <label for="source-url">YouTube URL</label>
            <input type="text" id="source-url" placeholder="YouTube URLを入力">
        `;
    },
    
    // 曲の基本情報を更新
    updateSongBasicInfo: function() {
        if (!this.currentSong) {
            this.resetEditor();
        }
        
        // フォームからデータを取得
        const title = document.getElementById('song-title').value.trim();
        const artist = document.getElementById('song-artist').value.trim();
        const sourceType = document.querySelector('.source-type-button.active').dataset.type;
        
        // 曲データを更新
        this.currentSong.title = title;
        this.currentSong.artist = artist;
        this.currentSong.sourceType = sourceType;
        
        // 音源タイプに応じてURL/IDを更新
        if (sourceType === 'youtube' || sourceType === 'niconico') {
            const url = document.getElementById('source-url').value.trim();
            this.currentSong.sourceUrl = url;
            
            // IDを抽出
            if (sourceType === 'youtube') {
                this.currentSong.sourceId = extractYouTubeId(url);
            } else {
                this.currentSong.sourceId = extractNiconicoId(url);
            }
        } else if (sourceType === 'local' && this.uploadedFile) {
            // ローカルファイルの場合、アップロード処理後のURLを設定
            this.currentSong.sourceUrl = this.uploadedFile.localUrl;
            this.currentSong.sourceId = this.uploadedFile.name;
        }
    },
    
    // 歌詞テキストを加工
    cleanLyricsText: function() {
        const lyricsTextarea = document.getElementById('lyrics-text');
        const text = lyricsTextarea.value;
        
        // 歌詞テキストをクリーンアップ
        const cleanedText = Lyrics.cleanupText(text);
        
        // 加工されたテキストに更新
        lyricsTextarea.value = cleanedText;
        
        showToast('歌詞テキストを整形しました', 'success');
    },
    
    // 特殊行（前奏・間奏）を追加
    addSpecialLine: function(text, type) {
        const lyricsTextarea = document.getElementById('lyrics-text');
        const updatedText = Lyrics.addSpecialLine(lyricsTextarea.value, type, 'cursor', lyricsTextarea);
        
        // 更新されたテキストを設定
        lyricsTextarea.value = updatedText;
        
        showToast(`${type === 'prelude' ? '前奏' : '間奏'}を追加しました`, 'success');
    },
    
    // ファイル選択処理
    handleFileSelection: function(files) {
        if (!files || files.length === 0) return;
        
        const file = files[0];
        const extension = getFileExtension(file.name).toLowerCase();
        
        // 対応ファイル形式か確認
        if (extension !== 'mp3' && extension !== 'wav') {
            showToast('MP3またはWAVファイルを選択してください', 'error');
            return;
        }
        
        // ファイルサイズ確認（最大50MB）
        if (file.size > 50 * 1024 * 1024) {
            showToast('ファイルサイズが大きすぎます（最大50MB）', 'error');
            return;
        }
        
        // ローカルURLの生成
        const localUrl = URL.createObjectURL(file);
        
        // アップロードファイル情報を保存
        this.uploadedFile = {
            file: file,
            name: file.name,
            localUrl: localUrl
        };
        
        showToast('ファイルを選択しました: ' + file.name, 'success');
    },
    
    // タイミング設定用の歌詞準備
    prepareLyricsForTiming: function() {
        // 歌詞テキストを取得して解析
        const lyricsText = document.getElementById('lyrics-text').value;
        const parsedLyrics = Lyrics.parseText(lyricsText);
        
        // 現在の曲データに歌詞情報を設定
        this.currentSong.lyrics = parsedLyrics;
        
        // タイミングリストを生成
        const lyricsTimingListElement = document.getElementById('lyrics-timing-list');
        lyricsTimingListElement.innerHTML = Lyrics.createLyricsListItems(parsedLyrics);
        
        // プレーヤーを初期化
        Player.initForEditing(this.currentSong);
    },
    
    // 歌詞行のタイミング設定
    setTimingForLine: function(index) {
        if (!this.currentSong || !this.currentSong.lyrics || index < 0 || index >= this.currentSong.lyrics.length) {
            return;
        }
        
        // 現在の時間を取得
        const currentTime = Player.getCurrentTime();
        
        // 歌詞タイミングを更新
        this.currentSong.lyrics[index].time = currentTime;
        
        // UI要素を更新
        const timingButton = document.querySelector(`.lyrics-timing-button[data-index="${index}"]`);
        if (timingButton) {
            timingButton.textContent = formatTime(currentTime);
            
            // 親要素にsetクラスを追加
            const timingItem = timingButton.closest('.lyrics-timing-item');
            if (timingItem) {
                timingItem.classList.add('set');
                timingItem.dataset.time = currentTime;
            }
        }
        
        // 同期モードの場合、次の行に自動的に移動
        if (this.isSyncMode && index < this.currentSong.lyrics.length - 1) {
            // 次の行の要素をアクティブにする
            const nextItem = document.querySelector(`.lyrics-timing-item[data-index="${index + 1}"]`);
            if (nextItem) {
                // 現在のアクティブ要素からアクティブクラスを削除
                document.querySelectorAll('.lyrics-timing-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // 次の行にアクティブクラスを追加
                nextItem.classList.add('active');
                
                // スクロール位置を調整
                nextItem.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    },
    
    // タイミングのリセット
    resetTiming: function() {
        if (!this.currentSong || !this.currentSong.lyrics) {
            return;
        }
        
        // 確認ダイアログ
        if (!confirm('すべてのタイミング設定をリセットしますか？')) {
            return;
        }
        
        // すべての行のタイミングをリセット
        this.currentSong.lyrics = Lyrics.resetTimings(this.currentSong.lyrics);
        
        // UIを更新
        const lyricsTimingListElement = document.getElementById('lyrics-timing-list');
        lyricsTimingListElement.innerHTML = Lyrics.createLyricsListItems(this.currentSong.lyrics);
        
        showToast('タイミングをリセットしました', 'info');
    },
    
    // 同期モードの切り替え
    toggleSyncMode: function() {
        this.isSyncMode = !this.isSyncMode;
        
        const syncModeButton = document.getElementById('sync-mode-toggle');
        if (syncModeButton) {
            if (this.isSyncMode) {
                syncModeButton.classList.add('active');
                syncModeButton.innerHTML = '<i class="fas fa-sync"></i> 同期モード: ON';
                showToast('同期モードがオンになりました。タイミングを設定すると自動的に次の行に移動します。', 'info');
            } else {
                syncModeButton.classList.remove('active');
                syncModeButton.innerHTML = '<i class="fas fa-sync"></i> 同期モード: OFF';
                showToast('同期モードがオフになりました', 'info');
            }
        }
    },
    
    // 曲データの保存
    saveSong: function() {
        if (!this.currentSong) {
            showToast('保存するデータがありません', 'error');
            return;
        }
        
        // 保存前に間奏・前奏の長さを自動計算
        this.calculateAllInterludeDurations();
        
        // ローカルファイルの場合、ファイルをアップロード
        if (this.currentSong.sourceType === 'local' && this.uploadedFile && this.uploadedFile.file) {
            // ファイルが新しく選択された場合のみアップロード
            if (!this.uploadedFile.uploaded) {
                // FormDataの作成
                const formData = new FormData();
                formData.append('audio', this.uploadedFile.file);
                
                // アップロード処理
                fetch('php/upload.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        // アップロード成功、URLを更新
                        this.currentSong.sourceUrl = result.data.url;
                        this.uploadedFile.uploaded = true;
                        
                        // サーバーに曲データを保存
                        this.saveToServer();
                    } else {
                        showToast('ファイルのアップロードに失敗しました: ' + result.message, 'error');
                    }
                })
                .catch(error => {
                    console.error('Upload error:', error);
                    showToast('アップロード処理中にエラーが発生しました', 'error');
                });
            } else {
                // 既にアップロード済みの場合は直接保存
                this.saveToServer();
            }
        } else {
            // ファイルアップロードが不要な場合は直接保存
            this.saveToServer();
        }
    },
    
    // 全ての間奏・前奏の長さを自動計算
    calculateAllInterludeDurations: function() {
        if (!this.currentSong || !this.currentSong.lyrics) {
            return;
        }
        
        const lyrics = this.currentSong.lyrics;
        
        // 時間でソート
        const sortedLyrics = [...lyrics].sort((a, b) => a.time - b.time);
        
        // 各間奏/前奏行に対して
        for (let i = 0; i < sortedLyrics.length; i++) {
            if (sortedLyrics[i].type !== 'normal') {
                const currentLine = sortedLyrics[i];
                
                // 次の行を探す（時間順）
                let nextTime = null;
                for (let j = 0; j < sortedLyrics.length; j++) {
                    if (sortedLyrics[j].time > currentLine.time) {
                        nextTime = sortedLyrics[j].time;
                        break;
                    }
                }
                
                if (nextTime !== null) {
                    // 次の行までの時間を計算
                    const duration = nextTime - currentLine.time;
                    // 最低3秒を確保
                    currentLine.duration = Math.max(duration, 3);
                    console.log(`間奏/前奏 "${currentLine.text}" の長さを ${currentLine.duration}秒に設定`);
                } else {
                    // 次の行がなければデフォルト30秒
                    currentLine.duration = 30;
                    console.log(`間奏/前奏 "${currentLine.text}" の長さをデフォルト30秒に設定`);
                }
            }
        }
        
        console.log('全ての間奏/前奏の長さを計算しました');
    },
    
    // サーバーに曲データを保存
    saveToServer: function() {
        App.saveSong(this.currentSong)
            .then(success => {
                if (success) {
                    showToast('曲を保存しました', 'success');
                    
                    // 曲一覧画面に戻る
                    setTimeout(() => {
                        navigateTo('song-list-screen');
                    }, 500);
                } else {
                    showToast('保存に失敗しました', 'error');
                }
            });
    },
    
    // 曲データの削除
    deleteSong: function(songId) {
        if (!songId) return;
        
        // 確認ダイアログ
        if (!confirm('この曲を削除しますか？この操作は元に戻せません。')) {
            return;
        }
        
        // 現在の曲データを取得
        const songs = loadFromLocalStorage('syncapp_songs') || [];
        
        // 指定されたIDの曲を削除
        const updatedSongs = songs.filter(song => song.id !== songId);
        
        // ローカルストレージに保存
        const saved = saveToLocalStorage('syncapp_songs', updatedSongs);
        
        if (saved) {
            showToast('曲を削除しました', 'success');
            
            // 曲一覧を更新
            App.loadSongs();
        } else {
            showToast('削除に失敗しました', 'error');
        }
    },
    
    // 編集用に曲をロード
    loadSongForEditing: function(songId) {
        // 指定されたIDの曲データを取得
        const song = App.getSongById(songId);
        
        if (!song) {
            showToast('曲データを読み込めませんでした', 'error');
            return;
        }
        
        // 現在の曲データを設定
        this.currentSong = JSON.parse(JSON.stringify(song)); // ディープコピー
        this.isEditing = true;
        
        // ステップ1：基本情報を設定
        document.getElementById('song-title').value = song.title;
        document.getElementById('song-artist').value = song.artist;
        
        // 音源タイプを選択
        document.querySelectorAll('.source-type-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`.source-type-button[data-type="${song.sourceType}"]`).classList.add('active');
        
        // 音源入力フィールドを設定
        let inputHtml = '';
        switch (song.sourceType) {
            case 'youtube':
                inputHtml = `
                    <label for="source-url">YouTube URL</label>
                    <input type="text" id="source-url" placeholder="YouTube URLを入力" value="${song.sourceUrl}">
                `;
                break;
            case 'niconico':
                inputHtml = `
                    <label for="source-url">ニコニコ動画 URL</label>
                    <input type="text" id="source-url" placeholder="ニコニコ動画URLを入力" value="${song.sourceUrl}">
                `;
                break;
            case 'local':
                inputHtml = `
                    <label for="source-file">音楽ファイル（MP3, WAV）</label>
                    <input type="file" id="source-file" accept=".mp3,.wav">
                    <p class="file-name">${song.sourceId}</p>
                `;
                // ローカルURLを設定
                this.uploadedFile = {
                    name: song.sourceId,
                    localUrl: song.sourceUrl
                };
                break;
        }
        document.getElementById('source-input-container').innerHTML = inputHtml;
        
        // ステップ2：歌詞テキストを生成
        let lyricsText = '';
        if (song.lyrics && song.lyrics.length > 0) {
            // 歌詞データからテキストを生成
            lyricsText = song.lyrics.map(line => {
                if (line.type === 'prelude') {
                    return '[前奏]';
                } else if (line.type === 'interlude') {
                    return '[間奏]';
                } else {
                    return line.text;
                }
            }).join('\n');
        }
        document.getElementById('lyrics-text').value = lyricsText;
        
        // 編集画面に遷移
        navigateTo('edit-step1-screen');
    }
};