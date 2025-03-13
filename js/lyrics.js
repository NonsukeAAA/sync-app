/**
 * SyncApp 歌詞処理モジュール
 * 個人用歌詞同期アプリ
 */

// 歌詞処理を管理するオブジェクト
const Lyrics = {
    // 歌詞テキストを行に分割し、基本的な構造体に変換
    parseText: function(text) {
        if (!text) return [];
        
        // 行に分割
        const lines = splitTextIntoLines(text);
        
        // 各行をオブジェクトに変換
        return lines.map((line, index) => {
            // 特殊行（前奏・間奏）のマーカーをチェック
            const isPrelude = line.includes('[前奏]');
            const isInterlude = line.includes('[間奏]');
            
            let lyricText = line;
            let lyricType = 'normal';
            
            if (isPrelude) {
                lyricText = '前奏';
                lyricType = 'prelude';
            } else if (isInterlude) {
                lyricText = '間奏';
                lyricType = 'interlude';
            }
            
            return {
                id: index + 1,
                text: lyricText,
                time: 0, // 初期値は0
                type: lyricType,
                duration: (isPrelude || isInterlude) ? 30 : undefined // 前奏・間奏のデフォルト長さを30秒に延長
            };
        });
    },
    
    // 歌詞テキストをクリーンアップ（空行の除去、整形など）
    cleanupText: function(text) {
        if (!text) return '';
        
        // 改行で分割
        let lines = text.split('\n');
        
        // 各行をトリム
        lines = lines.map(line => line.trim());
        
        // 連続する空行を除去（1つの空行は残す）
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i] === '' && (i === lines.length - 1 || lines[i + 1] === '')) {
                lines.splice(i, 1);
            }
        }
        
        // 先頭と末尾の空行を除去
        while (lines.length > 0 && lines[0] === '') {
            lines.shift();
        }
        
        while (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        
        // 整形した結果を改行で結合
        return lines.join('\n');
    },
    
    // 特殊行（前奏・間奏）を追加
    addSpecialLine: function(text, type, position = 'cursor', textArea = null) {
        if (!text) return text;
        
        const specialText = type === 'prelude' ? '[前奏]' : '[間奏]';
        
        // カーソル位置に挿入する場合
        if (position === 'cursor' && textArea) {
            const cursorPos = textArea.selectionStart;
            const textBefore = text.substring(0, cursorPos);
            const textAfter = text.substring(cursorPos);
            
            // カーソル位置が行の途中の場合は改行を挿入
            const needNewLineBefore = textBefore.length > 0 && !textBefore.endsWith('\n');
            const needNewLineAfter = textAfter.length > 0 && !textAfter.startsWith('\n');
            
            let newText = textBefore;
            if (needNewLineBefore) newText += '\n';
            newText += specialText;
            if (needNewLineAfter) newText += '\n';
            newText += textAfter;
            
            return newText;
        }
        // 先頭に挿入する場合
        else if (position === 'start') {
            return specialText + (text.startsWith('\n') ? '' : '\n') + text;
        }
        // 末尾に挿入する場合
        else if (position === 'end') {
            return text + (text.endsWith('\n') ? '' : '\n') + specialText;
        }
        
        return text;
    },
    
    // 歌詞の時間情報を更新
    updateTiming: function(lyrics, index, time) {
        if (!lyrics || index < 0 || index >= lyrics.length) return lyrics;
        
        // 指定されたインデックスの歌詞の時間を更新
        lyrics[index].time = time;
        
        return lyrics;
    },
    
    // 歌詞を時間順にソート
    sortByTime: function(lyrics) {
        if (!lyrics || lyrics.length === 0) return lyrics;
        
        // 時間でソート
        return [...lyrics].sort((a, b) => a.time - b.time);
    },
    
    // タイミング情報のリセット
    resetTimings: function(lyrics) {
        if (!lyrics) return [];
        
        // すべての歌詞行の時間をリセット
        return lyrics.map(line => ({
            ...line,
            time: 0
        }));
    },
    
    // 歌詞の表示用リスト要素を生成
    createLyricsListItems: function(lyrics) {
        if (!lyrics || lyrics.length === 0) return '';
        
        return lyrics.map((line, index) => {
            const timeText = line.time > 0 ? formatTime(line.time) : '--:--';
            const isSet = line.time > 0;
            const typeClass = line.type !== 'normal' ? `lyrics-timing-item-${line.type}` : '';
            
            return `
                <div class="lyrics-timing-item ${isSet ? 'set' : ''} ${typeClass}" data-index="${index}" data-time="${line.time}">
                    <div class="lyrics-timing-text">${line.text}</div>
                    <button class="lyrics-timing-button" data-index="${index}">${timeText}</button>
                </div>
            `;
        }).join('');
    },
    
    // 特定の時間に合う歌詞行を見つける
    findLyricAtTime: function(lyrics, time) {
        if (!lyrics || lyrics.length === 0) return null;
        
        // 現在の時間以前で最も近い歌詞を探す
        let currentLyric = null;
        
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time <= time) {
                currentLyric = lyrics[i];
            } else {
                break;
            }
        }
        
        return currentLyric;
    },
    
    // 前奏・間奏の長さを設定
    setSpecialLineDuration: function(lyrics, index, duration) {
        if (!lyrics || index < 0 || index >= lyrics.length || lyrics[index].type === 'normal') {
            return lyrics;
        }
        
        // 前奏・間奏の長さを設定
        lyrics[index].duration = duration;
        
        return lyrics;
    },
    
    // 歌詞テキストを整形（前奏・間奏マーカーの正規化など）
    formatLyricsText: function(text) {
        if (!text) return '';
        
        // 行に分割
        let lines = text.split('\n');
        
        // 各行を処理
        lines = lines.map(line => {
            line = line.trim();
            
            // 前奏・間奏マーカーの正規化
            if (line.toLowerCase().includes('前奏') || line.match(/^\[?intro/i)) {
                return '[前奏]';
            }
            
            if (line.toLowerCase().includes('間奏') || line.match(/^\[?interlude/i)) {
                return '[間奏]';
            }
            
            // その他の行はそのまま
            return line;
        });
        
        // 整形した結果を改行で結合
        return lines.join('\n');
    }
};