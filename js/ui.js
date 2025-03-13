/**
 * SyncApp UI操作モジュール
 * 個人用歌詞同期アプリ
 */

// UI操作を管理するオブジェクト
const UI = {
    // 初期化
    init: function() {
        this.setupEventListeners();
        this.setupBackButton();
    },
    
    // イベントリスナーのセットアップ
    setupEventListeners: function() {
        // 曲追加ボタン
        const addSongButton = document.getElementById('add-song-button');
        if (addSongButton) {
            addSongButton.addEventListener('click', () => {
                this.startNewSongFlow();
            });
        }
        
        // 設定ボタン
        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                navigateTo('settings-screen');
            });
        }
        
        // プレーヤー表示/非表示ボタン（再生画面）
        const togglePlayerButton = document.getElementById('toggle-player-button');
        if (togglePlayerButton) {
            togglePlayerButton.addEventListener('click', () => {
                this.toggleMediaPlayer('playback-media-player', togglePlayerButton);
            });
        }
        
        // プレーヤー表示/非表示ボタン（編集画面）
        const toggleEditorPlayerButton = document.getElementById('toggle-editor-player-button');
        if (toggleEditorPlayerButton) {
            toggleEditorPlayerButton.addEventListener('click', () => {
                this.toggleMediaPlayer('timing-media-player', toggleEditorPlayerButton);
            });
        }
        
        // 音源タイプ選択ボタン
        const sourceTypeButtons = document.querySelectorAll('.source-type-button');
        sourceTypeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.selectSourceType(e.currentTarget);
            });
        });
        
        // フィルターボタン
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.filterSongs(e.currentTarget.dataset.filter);
            });
        });
        
        // 曲カード（動的に生成される要素なのでイベント委譲で対応）
        document.getElementById('songs-grid').addEventListener('click', (e) => {
            const songCard = e.target.closest('.song-card');
            if (songCard) {
                // 編集/削除ボタンをクリックした場合は再生しない
                if (e.target.closest('.song-card-action')) {
                    return;
                }
                
                const songId = songCard.dataset.id;
                if (songId) {
                    this.openSong(songId);
                }
            }
        });
        
        // 曲カードの編集/削除ボタン
        document.getElementById('songs-grid').addEventListener('click', (e) => {
            const editButton = e.target.closest('.song-card-action-edit');
            const deleteButton = e.target.closest('.song-card-action-delete');
            
            if (editButton) {
                const songCard = editButton.closest('.song-card');
                if (songCard && songCard.dataset.id) {
                    Editor.loadSongForEditing(songCard.dataset.id);
                }
            } else if (deleteButton) {
                const songCard = deleteButton.closest('.song-card');
                if (songCard && songCard.dataset.id) {
                    // 確認はApp.deleteSong内で行われるので、ここでは直接実行
                    App.deleteSong(songCard.dataset.id);
                }
            }
        });
        
        // 長押しで曲カードのコンテキストメニューを表示（モバイル用）
        let longPressTimer;
        document.getElementById('songs-grid').addEventListener('touchstart', (e) => {
            const songCard = e.target.closest('.song-card');
            if (songCard) {
                // 編集/削除ボタンを長押ししたときはコンテキストメニューを表示しない
                if (e.target.closest('.song-card-action')) {
                    return;
                }
                
                longPressTimer = setTimeout(() => {
                    this.showContextMenu(e, songCard);
                }, 500);
            }
        });
        
        document.getElementById('songs-grid').addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });
        
        document.getElementById('songs-grid').addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });
        
        // 右クリックで曲カードのコンテキストメニューを表示（デスクトップ用）
        document.getElementById('songs-grid').addEventListener('contextmenu', (e) => {
            const songCard = e.target.closest('.song-card');
            if (songCard) {
                e.preventDefault();
                this.showContextMenu(e, songCard);
            }
        });
        
        // ドキュメント全体をクリックしたときにコンテキストメニューを閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.closeContextMenu();
            }
        });
        
        // 検索入力フィールド
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.searchSongs(e.target.value);
            }, 300));
        }
        
        // ステップ1の次へボタン
        const step1NextButton = document.getElementById('step1-next');
        if (step1NextButton) {
            step1NextButton.addEventListener('click', () => {
                if (this.validateStep1()) {
                    navigateTo('edit-step2-screen');
                }
            });
        }
        
        // ステップ1のキャンセルボタン
        const step1CancelButton = document.getElementById('step1-cancel');
        if (step1CancelButton) {
            step1CancelButton.addEventListener('click', () => {
                navigateTo('song-list-screen');
            });
        }
        
        // ステップ2の次へボタン
        const step2NextButton = document.getElementById('step2-next');
        if (step2NextButton) {
            step2NextButton.addEventListener('click', () => {
                if (this.validateStep2()) {
                    Editor.prepareLyricsForTiming();
                    navigateTo('edit-step3-screen');
                }
            });
        }
        
        // ステップ2の戻るボタン
        const step2BackButton = document.getElementById('step2-back');
        if (step2BackButton) {
            step2BackButton.addEventListener('click', () => {
                navigateTo('edit-step1-screen');
            });
        }
        
        // テキスト処理オプションボタン
        const cleanTextButton = document.getElementById('clean-text');
        if (cleanTextButton) {
            cleanTextButton.addEventListener('click', () => {
                Editor.cleanLyricsText();
            });
        }
        
        const addPreludeButton = document.getElementById('add-prelude');
        if (addPreludeButton) {
            addPreludeButton.addEventListener('click', () => {
                Editor.addSpecialLine('前奏', 'prelude');
            });
        }
        
        const addInterludeButton = document.getElementById('add-interlude');
        if (addInterludeButton) {
            addInterludeButton.addEventListener('click', () => {
                Editor.addSpecialLine('間奏', 'interlude');
            });
        }
        
        // ステップ3の保存ボタン
        const step3SaveButton = document.getElementById('step3-save');
        if (step3SaveButton) {
            step3SaveButton.addEventListener('click', () => {
                if (this.validateStep3()) {
                    Editor.saveSong();
                }
            });
        }
        
        // ステップ3の戻るボタン
        const step3BackButton = document.getElementById('step3-back');
        if (step3BackButton) {
            step3BackButton.addEventListener('click', () => {
                navigateTo('edit-step2-screen');
            });
        }
        
        // 再生/一時停止ボタン（タイミング設定画面）
        const playPauseTimingButton = document.getElementById('play-pause-timing');
        if (playPauseTimingButton) {
            playPauseTimingButton.addEventListener('click', () => {
                Player.togglePlayPause();
                this.updatePlayPauseButton();
            });
        }
        
        // タイミングリセットボタン
        const resetTimingButton = document.getElementById('reset-timing');
        if (resetTimingButton) {
            resetTimingButton.addEventListener('click', () => {
                Editor.resetTiming();
            });
        }
        
        // 同期モードトグルボタン
        const syncModeToggleButton = document.getElementById('sync-mode-toggle');
        if (syncModeToggleButton) {
            syncModeToggleButton.addEventListener('click', () => {
                Editor.toggleSyncMode();
            });
        }
        
        // 再生コントロール（再生画面）
        const playbackPlayPauseButton = document.getElementById('playback-play-pause');
        if (playbackPlayPauseButton) {
            playbackPlayPauseButton.addEventListener('click', () => {
                Player.togglePlayPause();
                this.updatePlayPauseButton(true);
            });
        }
        
        const playbackPreviousButton = document.getElementById('playback-previous');
        if (playbackPreviousButton) {
            playbackPreviousButton.addEventListener('click', () => {
                Player.previousLine();
            });
        }
        
        const playbackNextButton = document.getElementById('playback-next');
        if (playbackNextButton) {
            playbackNextButton.addEventListener('click', () => {
                Player.nextLine();
            });
        }
        
        const playbackFullscreenButton = document.getElementById('playback-fullscreen');
        if (playbackFullscreenButton) {
            playbackFullscreenButton.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // キャッシュ設定
        const enableCacheToggle = document.getElementById('enable-cache');
        if (enableCacheToggle) {
            // 初期値を設定
            const cachingDisabled = loadFromLocalStorage('syncapp_disable_cache') || false;
            enableCacheToggle.checked = !cachingDisabled;
            
            enableCacheToggle.addEventListener('change', (e) => {
                saveToLocalStorage('syncapp_disable_cache', !e.target.checked);
                showToast(e.target.checked ? 'メディアキャッシュを有効にしました' : 'メディアキャッシュを無効にしました', 'info');
            });
        }
        
        // キャッシュクリアボタン
        const clearCacheButton = document.getElementById('clear-cache');
        if (clearCacheButton) {
            clearCacheButton.addEventListener('click', () => {
                if (confirm('キャッシュされたメディアデータをすべて削除しますか？')) {
                    this.clearMediaCache();
                }
            });
        }
        
        // データエクスポートボタン
        const exportDataButton = document.getElementById('export-data');
        if (exportDataButton) {
            exportDataButton.addEventListener('click', () => {
                App.exportData();
            });
        }
        
        // データインポートボタン
        const importDataButton = document.getElementById('import-data');
        const importFileInput = document.getElementById('import-file');
        if (importDataButton && importFileInput) {
            importDataButton.addEventListener('click', () => {
                importFileInput.click();
            });
            
            importFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    
                    reader.onload = (event) => {
                        try {
                            const jsonData = event.target.result;
                            App.importData(jsonData);
                        } catch (error) {
                            showToast('データの読み込みに失敗しました', 'error');
                        }
                    };
                    
                    reader.readAsText(file);
                }
            });
        }
    },
    
    // 戻るボタンのセットアップ
    setupBackButton: function() {
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                const activeScreen = document.querySelector('.screen.active');
                if (!activeScreen) return;
                
                const screenId = activeScreen.id;
                
                switch (screenId) {
                    case 'edit-step1-screen':
                        navigateTo('song-list-screen');
                        break;
                    case 'edit-step2-screen':
                        navigateTo('edit-step1-screen');
                        break;
                    case 'edit-step3-screen':
                        navigateTo('edit-step2-screen');
                        break;
                    case 'playback-screen':
                        Player.stop();
                        navigateTo('song-list-screen');
                        break;
                    case 'settings-screen':
                        navigateTo('song-list-screen');
                        break;
                    default:
                        navigateTo('song-list-screen');
                }
            });
        }
    },
    
    // 新規曲追加フローを開始
    startNewSongFlow: function() {
        // 編集画面をリセット
        Editor.resetEditor();
        
        // ステップ1画面に遷移
        navigateTo('edit-step1-screen');
    },
    
    // メディアプレーヤーの表示/非表示を切り替え
    toggleMediaPlayer: function(containerId, button) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // 表示/非表示を切り替え
        const isVisible = container.classList.toggle('visible');
        
        // ボタンのテキストとアイコンを更新
        if (button) {
            if (isVisible) {
                button.innerHTML = '<i class="fas fa-chevron-up"></i> プレーヤーを非表示';
            } else {
                button.innerHTML = '<i class="fas fa-chevron-down"></i> プレーヤーを表示';
            }
        }
    },
    
    // コンテキストメニューを表示
    showContextMenu: function(event, songCard) {
        // 既存のコンテキストメニューを削除
        this.closeContextMenu();
        
        const songId = songCard.dataset.id;
        if (!songId) return;
        
        // コンテキストメニューを作成
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.id = 'song-context-menu';
        
        // メニュー項目を追加
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="play">
                <i class="fas fa-play"></i> 再生
            </div>
            <div class="context-menu-item" data-action="edit">
                <i class="fas fa-edit"></i> 編集
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> 削除
            </div>
        `;
        
        // メニュー位置を設定
        let x, y;
        if (event.type === 'touchstart') {
            // タッチイベントの場合
            x = event.touches[0].clientX;
            y = event.touches[0].clientY;
        } else {
            // マウスイベントの場合
            x = event.clientX;
            y = event.clientY;
        }
        
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        
        // メニューをドキュメントに追加
        document.body.appendChild(contextMenu);
        
        // メニュー項目のクリックイベントを設定
        contextMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (!menuItem) return;
            
            const action = menuItem.dataset.action;
            
            switch (action) {
                case 'play':
                    this.openSong(songId);
                    break;
                case 'edit':
                    Editor.loadSongForEditing(songId);
                    break;
                case 'delete':
                    // 確認はApp.deleteSong内で行われる
                    App.deleteSong(songId);
                    break;
            }
            
            this.closeContextMenu();
        });
        
        // メニューがビューポート外にはみ出さないように調整
        const menuRect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (menuRect.right > viewportWidth) {
            contextMenu.style.left = `${viewportWidth - menuRect.width - 10}px`;
        }
        
        if (menuRect.bottom > viewportHeight) {
            contextMenu.style.top = `${viewportHeight - menuRect.height - 10}px`;
        }
    },
    
    // コンテキストメニューを閉じる
    closeContextMenu: function() {
        const contextMenu = document.getElementById('song-context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }
    },
    
    // メディアキャッシュをクリア
    clearMediaCache: function() {
        // IndexedDBをクリア
        try {
            const request = window.indexedDB.deleteDatabase('SyncAppMediaCache');
            request.onsuccess = function() {
                showToast('メディアキャッシュをクリアしました', 'success');
            };
            request.onerror = function() {
                showToast('キャッシュのクリアに失敗しました', 'error');
            };
        } catch (e) {
            console.error('IndexedDB error:', e);
            showToast('キャッシュのクリアに失敗しました', 'error');
        }
    },
    
    // 音源タイプを選択
    selectSourceType: function(selectedButton) {
        // すべてのボタンからアクティブクラスを削除
        document.querySelectorAll('.source-type-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // 選択されたボタンにアクティブクラスを追加
        selectedButton.classList.add('active');
        
        // 音源タイプに応じて入力フィールドを変更
        const sourceType = selectedButton.dataset.type;
        const sourceInputContainer = document.getElementById('source-input-container');
        
        let inputHtml = '';
        
        switch (sourceType) {
            case 'youtube':
                inputHtml = `
                    <label for="source-url">YouTube URL</label>
                    <input type="text" id="source-url" placeholder="YouTube URLを入力">
                `;
                break;
            case 'niconico':
                inputHtml = `
                    <label for="source-url">ニコニコ動画 URL</label>
                    <input type="text" id="source-url" placeholder="ニコニコ動画URLを入力">
                `;
                break;
            case 'local':
                inputHtml = `
                    <label for="source-file">音楽ファイル（MP3, WAV）</label>
                    <input type="file" id="source-file" accept=".mp3,.wav">
                `;
                break;
        }
        
        sourceInputContainer.innerHTML = inputHtml;
        
        // 現在の編集中データを更新
        if (Editor.currentSong) {
            Editor.currentSong.sourceType = sourceType;
        }
    },
    
    // 曲を検索
    searchSongs: function(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const songCards = document.querySelectorAll('.song-card');
        
        songCards.forEach(card => {
            const title = card.querySelector('.song-card-title').textContent.toLowerCase();
            const artist = card.querySelector('.song-card-artist').textContent.toLowerCase();
            
            if (title.includes(normalizedQuery) || artist.includes(normalizedQuery)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        
        // 検索結果がない場合のメッセージ表示
        const songsGrid = document.getElementById('songs-grid');
        const noResultsMessage = document.getElementById('no-results-message');
        
        if (Array.from(songCards).every(card => card.style.display === 'none')) {
            if (!noResultsMessage) {
                const message = document.createElement('div');
                message.id = 'no-results-message';
                message.className = 'no-results-message';
                message.textContent = '検索結果がありません';
                songsGrid.appendChild(message);
            }
        } else if (noResultsMessage) {
            noResultsMessage.remove();
        }
    },
    
    // 曲をフィルター
    filterSongs: function(filter) {
        // すべてのフィルターボタンからアクティブクラスを削除
        document.querySelectorAll('.filter-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // 選択されたフィルターボタンにアクティブクラスを追加
        document.querySelector(`.filter-button[data-filter="${filter}"]`).classList.add('active');
        
        // 曲カードをフィルタリング
        const songCards = document.querySelectorAll('.song-card');
        
        songCards.forEach(card => {
            if (filter === 'all' || card.dataset.sourceType === filter) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        
        // フィルター結果がない場合のメッセージ表示
        const songsGrid = document.getElementById('songs-grid');
        const noResultsMessage = document.getElementById('no-results-message');
        
        if (Array.from(songCards).every(card => card.style.display === 'none')) {
            if (!noResultsMessage) {
                const message = document.createElement('div');
                message.id = 'no-results-message';
                message.className = 'no-results-message';
                message.textContent = 'この条件に一致する曲はありません';
                songsGrid.appendChild(message);
            }
        } else if (noResultsMessage) {
            noResultsMessage.remove();
        }
    },
    
    // 曲を開く
    openSong: function(songId) {
        // 指定されたIDの曲データを取得
        const song = App.getSongById(songId);
        
        if (!song) {
            showToast('曲データを読み込めませんでした', 'error');
            return;
        }
        
        // 再生画面の初期化
        this.initPlaybackScreen(song);
        
        // 再生画面に遷移
        navigateTo('playback-screen');
        
        // プレーヤーを初期化して再生開始
        Player.initForPlayback(song);
    },
    
    // 再生画面の初期化
    initPlaybackScreen: function(song) {
        // 曲情報を表示
        document.getElementById('playback-title').textContent = song.title;
        document.getElementById('playback-artist').textContent = song.artist;
        
        // 歌詞表示領域をリセット
        document.getElementById('previous-lyrics').textContent = '';
        document.getElementById('current-lyrics').textContent = '';
        document.getElementById('next-lyrics').textContent = '';
        
        // 曲タイトルをヘッダーに表示
        document.getElementById('header-context').textContent = song.title;
    },
    
    // 歌詞表示を更新
    updateLyricsDisplay: function(prevLine, currentLine, nextLine) {
        const prevLyricsElement = document.getElementById('previous-lyrics');
        const currentLyricsElement = document.getElementById('current-lyrics');
        const nextLyricsElement = document.getElementById('next-lyrics');
        
        // アニメーション用のクラスを追加
        prevLyricsElement.style.transition = 'opacity 0.5s, transform 0.5s';
        currentLyricsElement.style.transition = 'opacity 0.5s, transform 0.5s';
        nextLyricsElement.style.transition = 'opacity 0.5s, transform 0.5s';
        
        // いったん透明化
        prevLyricsElement.style.opacity = '0';
        currentLyricsElement.style.opacity = '0';
        nextLyricsElement.style.opacity = '0';
        
        // 少し待ってからコンテンツを更新
        setTimeout(() => {
            // 歌詞テキストを更新
            prevLyricsElement.textContent = prevLine ? prevLine.text : '';
            currentLyricsElement.textContent = currentLine ? currentLine.text : '';
            nextLyricsElement.textContent = nextLine ? nextLine.text : '';
            
            // 表示を元に戻す
            prevLyricsElement.style.opacity = '0.5';
            currentLyricsElement.style.opacity = '1';
            nextLyricsElement.style.opacity = '0.5';
            
            // スムーズスクロールでコンテナを中央に配置
            const lyricsContainer = document.querySelector('.lyrics-display-container');
            if (lyricsContainer && currentLyricsElement) {
                // 現在の歌詞がちょうどページの中央に来るようにスクロール
                lyricsContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 250);
    },
    
    // 間奏オーバーレイを表示/非表示
    toggleInterludeOverlay: function(show, type = 'interlude', remainingTime = 0) {
        const interludeOverlay = document.getElementById('interlude-overlay');
        const interludeLabel = document.getElementById('interlude-label');
        const interludeTime = document.getElementById('interlude-time');
        
        if (show) {
            interludeLabel.textContent = type === 'prelude' ? '前奏' : '間奏';
            interludeTime.textContent = formatTime(remainingTime);
            interludeOverlay.classList.add('active');
            // カウントダウン中も操作可能（pointer-eventsは変更しない）
        } else {
            interludeOverlay.classList.remove('active');
        }
    },
    
    // 再生/一時停止ボタンの状態を更新
    updatePlayPauseButton: function(isPlaybackScreen = false) {
        const buttonId = isPlaybackScreen ? 'playback-play-pause' : 'play-pause-timing';
        const button = document.getElementById(buttonId);
        
        if (!button) return;
        
        const icon = button.querySelector('i');
        
        if (Player.isPlaying()) {
            icon.className = 'fas fa-pause';
            button.setAttribute('aria-label', '一時停止');
        } else {
            icon.className = 'fas fa-play';
            button.setAttribute('aria-label', '再生');
        }
    },
    
    // タイミング設定画面のUIを更新
    updateTimingUI: function(currentTime) {
        const lyricsItems = document.querySelectorAll('.lyrics-timing-item');
        
        lyricsItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // 現在の時間に最も近い（かつ時間が設定済みの）行を探す
        let closestItem = null;
        let minDiff = Infinity;
        
        lyricsItems.forEach(item => {
            const time = parseFloat(item.dataset.time);
            if (!isNaN(time) && time <= currentTime) {
                const diff = currentTime - time;
                if (diff < minDiff) {
                    minDiff = diff;
                    closestItem = item;
                }
            }
        });
        
        if (closestItem) {
            closestItem.classList.add('active');
            
            // 自動スクロール
            closestItem.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    },
    
    // フルスクリーン切り替え
    toggleFullscreen: function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showToast('フルスクリーンの切り替えに失敗しました', 'error');
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    },
    
    // 曲一覧を更新
    updateSongsList: function(songs) {
        const songsGrid = document.getElementById('songs-grid');
        songsGrid.innerHTML = ''; // リストをクリア
        
        if (!songs || songs.length === 0) {
            songsGrid.innerHTML = '<div class="no-songs-message">曲が登録されていません</div>';
            return;
        }
        
        // 各曲のカードを作成
        songs.forEach(song => {
            const songCard = document.createElement('div');
            songCard.className = 'song-card';
            songCard.dataset.id = song.id;
            songCard.dataset.sourceType = song.sourceType;
            
            // 音源タイプに応じたアイコン
            let sourceIcon = '';
            switch (song.sourceType) {
                case 'youtube':
                    sourceIcon = '<i class="fab fa-youtube"></i>';
                    break;
                case 'niconico':
                    sourceIcon = '<i class="fas fa-play"></i>';
                    break;
                case 'local':
                    sourceIcon = '<i class="fas fa-music"></i>';
                    break;
            }
            
            songCard.innerHTML = `
                <div class="song-card-title">${song.title}</div>
                <div class="song-card-artist">${song.artist}</div>
                <div class="song-card-source">${sourceIcon}</div>
                <div class="song-card-actions">
                    <button class="song-card-action song-card-action-edit" title="編集">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="song-card-action song-card-action-delete" title="削除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            songsGrid.appendChild(songCard);
        });
    },
    
    // ステップ1のバリデーション
    validateStep1: function() {
        const titleInput = document.getElementById('song-title');
        const artistInput = document.getElementById('song-artist');
        const selectedSourceType = document.querySelector('.source-type-button.active').dataset.type;
        
        // タイトルのバリデーション
        if (!titleInput.value.trim()) {
            showToast('曲名を入力してください', 'error');
            titleInput.focus();
            return false;
        }
        
        // アーティストのバリデーション
        if (!artistInput.value.trim()) {
            showToast('アーティスト名を入力してください', 'error');
            artistInput.focus();
            return false;
        }
        
        // 音源情報のバリデーション
        if (selectedSourceType === 'youtube' || selectedSourceType === 'niconico') {
            const urlInput = document.getElementById('source-url');
            if (!urlInput.value.trim()) {
                showToast('URLを入力してください', 'error');
                urlInput.focus();
                return false;
            }
            
            // URLの形式チェック
            if (selectedSourceType === 'youtube' && !extractYouTubeId(urlInput.value)) {
                showToast('有効なYouTube URLを入力してください', 'error');
                urlInput.focus();
                return false;
            }
            
            if (selectedSourceType === 'niconico' && !extractNiconicoId(urlInput.value)) {
                showToast('有効なニコニコ動画URLを入力してください', 'error');
                urlInput.focus();
                return false;
            }
        } else if (selectedSourceType === 'local') {
            const fileInput = document.getElementById('source-file');
            if (!fileInput.files || fileInput.files.length === 0) {
                showToast('ファイルを選択してください', 'error');
                return false;
            }
            
            const file = fileInput.files[0];
            const extension = getFileExtension(file.name).toLowerCase();
            
            if (extension !== 'mp3' && extension !== 'wav') {
                showToast('MP3またはWAVファイルを選択してください', 'error');
                return false;
            }
        }
        
        // 編集中の曲データを更新
        Editor.updateSongBasicInfo();
        
        return true;
    },
    
    // ステップ2のバリデーション
    validateStep2: function() {
        const lyricsText = document.getElementById('lyrics-text').value;
        
        if (!lyricsText.trim()) {
            showToast('歌詞を入力してください', 'error');
            return false;
        }
        
        return true;
    },
    
    // ステップ3のバリデーション
    validateStep3: function() {
        const timingItems = document.querySelectorAll('.lyrics-timing-item');
        let allSet = true;
        
        // すべての行にタイミングが設定されているか確認
        timingItems.forEach(item => {
            if (!item.classList.contains('set')) {
                allSet = false;
            }
        });
        
        if (!allSet) {
            // 確認ダイアログ
            if (!confirm('タイミングが設定されていない行があります。このまま保存しますか？')) {
                return false;
            }
        }
        
        return true;
    }
};