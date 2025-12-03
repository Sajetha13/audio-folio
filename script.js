// --- 1. SETUP SUPABASE ---
// I have inserted your keys here. DO NOT CHANGE THESE LINES.
const SUPABASE_URL = 'https://qqmmokdalfzozgoawigs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbW1va2RhbGZ6b3pnb2F3aWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2OTE2NjcsImV4cCI6MjA4MDI2NzY2N30.oKYOpuYrB5la8izoLk1YNidSKrRBL6znNKFfUpcriNE';

// Initialize Client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let songs = []; // Empty start, we fill this from DB

// --- 2. FETCH DATA (SONGS + PLAYLISTS) ---
async function fetchSongs() {
    console.log("Fetching library...");
    
    // 1. Fetch Songs: SORT BY YEAR (Newest First)
    const { data: songData, error: songError } = await db
        .from('songs')
        .select('*')
        .order('year', { ascending: false }); // <--- BACK TO YEAR SORT

    // 2. Fetch Playlists
    const { data: playlistData, error: plError } = await db
        .from('playlists')
        .select('*');

    if (songError || plError) {
        console.error("Error:", songError || plError);
        return;
    }

    // Map Songs (ADD trackOrder here!)
    songs = songData.map(item => ({
        title: item.title,
        artist: item.artist,
        album: item.album,
        type: item.type,
        year: item.year,
        duration: item.duration,
        src: item.mp3_url,
        cover: item.cover_url,
        isPopular: item.is_popular,
        description: item.description,
        lyrics: item.lyrics,
        trackOrder: item.track_order || 0 // <--- NEW: Read the order number
    }));

    // Map Playlists
    if (playlistData) {
        playlists = playlistData;
    }

    // Initialize
    if (songs.length > 0) {
        loadSong(songs[0]);
        renderHome();
        const firstPop = songs.find(s => s.isPopular);
        if(firstPop) updateLyricsPanel(firstPop);
        else updateLyricsPanel(songs[0]);
    }
}

// --- 3. STANDARD VARIABLES ---
const audio = new Audio();
let songIndex = 0;
let isPlaying = false;
let playMode = 0; 
let playlists = [];

// Elements
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playerAlbum = document.getElementById('player-album');
const albumArt = document.getElementById('album-art');
const currTimeEl = document.getElementById('curr-time');
const totalTimeEl = document.getElementById('total-time');
const progressBar = document.querySelector('.fill');
const iconShuffle = document.getElementById('status-shuffle');
const iconRepeat = document.getElementById('status-repeat');
const iconRepeat1 = document.getElementById('status-repeat-1');
const menuBtn = document.querySelector('.menu-btn');
const nextBtn = document.querySelector('.next-btn');
const prevBtn = document.querySelector('.prev-btn');
const playBtn = document.querySelector('.play-btn');
const centerBtn = document.getElementById('select-btn');
const progressBarContainer = document.querySelector('.progress-bar');
const lyricsSongTitle = document.getElementById('lyrics-song-title');
const lyricsSongDesc  = document.getElementById('lyrics-song-desc');
const lyricsText      = document.getElementById('lyrics-text');

// --- 4. LAYOUT FUNCTIONS ---

function renderHome() {
    const container = document.querySelector('.middle-panel');
    if (!container) return; 

    // Filter data
    const popularSongs = songs.filter(s => s.isPopular).slice(0, 5);
    const releases = getUniqueReleases(); 

    // Inject HTML (This overwrites the Skeleton Loader)
    container.innerHTML = `
        <div style="padding-bottom: 50px;">
            <h1 class="zz-title">ZIPPIYZAP’S AUDIOFOLIO</h1>
            <p class="zz-subtitle">Lyrics, melodies and other tragedies</p>
            <div class="zz-artist">Zephy <i class="fas fa-check-circle" style="color: #007aff;"></i></div>
            <div class="zz-controls">
                <span onclick="playAll()">Play</span> | <span onclick="toggleShuffle()">Shuffle</span>
            </div>

            <h2 class="zz-section-title">Favorites (Popular)</h2>
            <ul class="zz-popular-list">
                ${popularSongs.map((song, i) => `
                    <li class="zz-row" onclick="playSpecificSong('${song.title}')">
                        <div class="zz-row-left"><span class="row-num">${i + 1}.</span> <span>${song.title}</span></div>
                        <span class="t-dur">${song.duration}</span>
                    </li>
                `).join('')}
            </ul>

            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px;">
                <h2 class="zz-section-title" style="margin:0;">Discography</h2>
                <span class="show-all-link" onclick="renderShowAll()">show all</span>
            </div>
            
            <div class="zz-grid">
                ${releases.map(release => `
                    <div class="zz-card" onclick="renderAlbumView('${release.name}')">
                        <div class="zz-cover-placeholder">
                            ${release.cover ? `<img src="${release.cover}" style="width:100%; height:100%; object-fit:cover;">` : '[cover]'}
                        </div>
                        <h4>${release.name}</h4>
                        <p>${release.type} • ${release.year}</p>
                    </div>
                `).join('')}
            </div>
             <h2 class="zz-section-title">About</h2>
            
            <div class="zz-about-box" style="align-items: flex-start;">
                
                <img src="https://via.placeholder.com/150" class="zz-about-img" style="object-fit: cover;">
                
                <div class="zz-about-text">
                    <p style="font-weight: 500; font-size: 15px; margin-bottom: 10px;">
                        Writing the soundtrack for the main character moments you’re too scared to admit you’re having. Welcome to the archives.
                    </p>
                    <p style="font-style: italic; color: #666; font-size: 14px;">
                        "if it doesn't crush us, then we don't want it."
                    </p>
                </div>
            </div>
            <br><br>

            ${playlists.length > 0 ? `
                <br>
                <h2 class="zz-section-title">Artist Playlists</h2>
                <div class="zz-grid">
                    ${playlists.map(pl => `
                        <div class="zz-card" onclick="renderPlaylistView('${pl.title}')">
                            <div class="zz-cover-placeholder">
                                <img src="${pl.cover_url || 'https://via.placeholder.com/150'}" style="width:100%; height:100%; object-fit:cover;">
                            </div>
                            <h4>${pl.title}</h4>
                            <p>${pl.description || 'By Zephy'}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

        </div>
    `;

    
}

// --- B. RENDER "SHOW ALL" (New Spotify-List Style) ---
// --- B. RENDER "SHOW ALL" (Fixed Spacing, Black Button, Separated Lists) ---
function renderShowAll() {
    const container = document.querySelector('.middle-panel');
    
    // 1. Get Unique Releases
    const releases = getUniqueReleases();
    
    // 2. Separate them
    const albums = releases.filter(r => r.type === 'Album');
    const singles = releases.filter(r => r.type === 'Single' || r.type === 'EP');

    // 3. Build the HTML
    let htmlContent = `
        <div style="padding-bottom: 50px;">
            <div class="back-nav-area">
                <span class="back-link" onclick="renderHome()">
                    <i class="fas fa-arrow-left"></i> Back to Home
                </span>
            </div>

            <h2 class="zz-section-title">Albums</h2>
            ${albums.length > 0 ? albums.map(album => generateReleaseHTML(album)).join('') : '<p style="color:#999;">No albums yet.</p>'}

            ${singles.length > 0 ? `
                <br>
                <h2 class="zz-section-title">Singles & EPs</h2>
                ${singles.map(single => generateReleaseHTML(single)).join('')}
            ` : ''}
        </div>
    `;

    container.innerHTML = htmlContent;
}

function renderAlbumView(albumName) {
    const container = document.querySelector('.middle-panel');
    
    // 1. Filter songs for this album
    // 2. SORT them by trackOrder (Low to High)
    const albumSongs = songs
        .filter(s => s.album === albumName)
        .sort((a, b) => a.trackOrder - b.trackOrder); // <--- THE FIX
    
    const albumInfo = getUniqueReleases().find(r => r.name === albumName);

    container.innerHTML = `
        <div style="padding-bottom: 50px;">
            <div class="back-nav-area">
                <span class="back-link" onclick="renderHome()">
                    <i class="fas fa-home"></i> Home
                </span>
                <span style="color:#ccc; margin:0 10px;">/</span>
                <span class="back-link" onclick="renderShowAll()">
                    Discography
                </span>
            </div>
            ${generateReleaseHTML(albumInfo)}
        </div>
    `;
}

// --- HELPER: Generates the HTML for one Release (Cover + Header + Tracks) ---
function generateReleaseHTML(release) {
    // Filter AND Sort by Track Order
    const tracks = songs
        .filter(s => s.album === release.name)
        .sort((a, b) => a.trackOrder - b.trackOrder); // <--- THE FIX

    return `
    <div class="zz-release-container">
        <div class="zz-release-header">
            <img src="${release.cover}" class="release-cover">
            <div class="release-info">
                <span class="release-type">${release.type}</span>
                <div class="release-title">${release.name}</div>
                <div class="release-meta">
                    <button class="play-btn-black" onclick="playAlbum('${release.name}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <span>${release.year} • ${tracks.length} Songs</span>
                </div>
            </div>
        </div>

        <ul class="zz-track-list">
            ${tracks.map((song, i) => `
                <li class="zz-track-row" onclick="playSpecificSong('${song.title}')">
                    <span class="track-idx">${i + 1}</span>
                    <span class="track-name">${song.title}</span>
                    <span class="track-time">${song.duration}</span>
                </li>
            `).join('')}
        </ul>
    </div>
    `;
}

// --- HELPER: Play Album Context (Smart Toggle) ---
function playAlbum(albumName) {
    // 1. Check if we are ALREADY playing this album
    const currentSong = songs[songIndex];
    if (currentSong && currentSong.album === albumName) {
        if (isPlaying) pauseSong();
        else playSong();
        return; // Stop here, don't restart!
    }

    // 2. If not, find tracks for this album
    // Sort by trackOrder to ensure we start at Track 1
    const albumTracks = songs
        .filter(s => s.album === albumName)
        .sort((a, b) => (a.trackOrder || 0) - (b.trackOrder || 0));

    // 3. Find the FIRST track that actually has Audio
    const firstPlayable = albumTracks.find(s => s.src && s.src !== "");

    if(firstPlayable) {
        playSpecificSong(firstPlayable.title);
    } else {
        alert("This album is Lyrics-Only (No audio found).");
    }
}

// --- 5. HELPERS ---
function getUniqueReleases() {
    const unique = [];
    const seen = new Set();
    songs.forEach(s => {
        if (!seen.has(s.album)) {
            seen.add(s.album);
            unique.push({ name: s.album, cover: s.cover, type: s.type, year: s.year });
        }
    });
    return unique;
}

function playSpecificSong(title) {
    const index = songs.findIndex(s => s.title === title);
    if(index !== -1) {
        songIndex = index;
        loadSong(songs[songIndex]);
        playSong();
    }
}

function updateLyricsPanel(song) {
    if(!lyricsSongTitle) return;
    lyricsSongTitle.innerText = song.title;
    
    if (song.description) {
        lyricsSongDesc.innerText = song.description;
    } else {
        lyricsSongDesc.innerText = `${song.album} • ${song.year}`;
    }

    if (song.lyrics) {
        lyricsText.innerText = song.lyrics;
    } else {
        lyricsText.innerText = "Lyrics not available.";
    }
}

// --- NEW: RENDER PLAYLIST VIEW ---
function renderPlaylistView(playlistTitle) {
    const container = document.querySelector('.middle-panel');
    const playlist = playlists.find(p => p.title === playlistTitle);
    
    if(!playlist) return;

    // Filter songs that match the titles in playlist.songs array
    const playlistTracks = songs.filter(s => playlist.songs.includes(s.title));

    container.innerHTML = `
        <div style="padding-bottom: 50px;">
            <div class="back-nav-area">
                <span class="back-link" onclick="renderHome()">
                    <i class="fas fa-arrow-left"></i> Back to Home
                </span>
            </div>
            
            <div class="zz-release-container">
                <div class="zz-release-header">
                    <img src="${playlist.cover_url}" class="release-cover">
                    <div class="release-info">
                        <span class="release-type">PLAYLIST</span>
                        <div class="release-title">${playlist.title}</div>
                        <div class="release-meta">
                            <button class="play-btn-black" onclick="playPlaylist('${playlist.title}')">
                                <i class="fas fa-play"></i>
                            </button>
                            <span>${playlist.description} • ${playlistTracks.length} Songs</span>
                        </div>
                    </div>
                </div>

                <ul class="zz-track-list">
                    ${playlistTracks.map((song, i) => `
                        <li class="zz-track-row" onclick="playSpecificSong('${song.title}')">
                            <span class="track-idx">${i + 1}</span>
                            <span class="track-name">${song.title}</span>
                            <span class="track-time">${song.duration}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

// --- HELPER: Play Playlist Context (Smart Toggle) ---
function playPlaylist(playlistTitle) {
    const playlist = playlists.find(p => p.title === playlistTitle);
    if(!playlist) return;

    // 1. Check if we are ALREADY playing a song from this playlist
    const currentSong = songs[songIndex];
    // (Simple check: is the current song title inside this playlist?)
    if (currentSong && playlist.songs.includes(currentSong.title)) {
        if (isPlaying) pauseSong();
        else playSong();
        return;
    }

    // 2. Find first playable song in playlist
    // We have to check the order of titles in the playlist array
    let firstPlayableTitle = null;
    
    for (let title of playlist.songs) {
        const s = songs.find(song => song.title === title);
        if (s && s.src && s.src !== "") {
            firstPlayableTitle = title;
            break; // Found the first valid one
        }
    }

    if (firstPlayableTitle) {
        playSpecificSong(firstPlayableTitle);
    } else {
        alert("This playlist has no playable audio.");
    }
}

function loadSong(song) {
    if(!song) return;
    playerTitle.innerText = song.title;
    playerArtist.innerText = song.artist;
    playerAlbum.innerText = song.album;
    
    // Update Album Art
    // FIX: Handle missing cover gracefully
    const coverUrl = song.cover || "https://via.placeholder.com/150";
    albumArt.innerHTML = `<img src="${coverUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">`;
    
    // FIX: Handle Audio Source
    if (song.src && song.src !== "") {
        audio.src = song.src;
        // Don't auto-play here (play functions handle that)
        // But we enable buttons
    } else {
        audio.src = ""; // Clear source
        // Show visual indicator
        playerTitle.innerText += " (Lyrics Only)";
    }

    updateLyricsPanel(song);
}

function playSong() { isPlaying = true; audio.play(); }
function pauseSong() { isPlaying = false; audio.pause(); }
function toggleShuffle() { playMode = 1; iconShuffle.classList.remove('hidden'); let newIndex = Math.floor(Math.random() * songs.length); songIndex = newIndex; loadSong(songs[songIndex]); playSong(); }
function playAll() { playMode = 0; songIndex = 0; loadSong(songs[songIndex]); playSong(); }

// --- PLAYER LOGIC (Smart Skip) ---

function nextSong() {
    // Strict Repeat One Rule
    if (playMode === 4) { 
        if (songs[songIndex].src) { 
            audio.currentTime = 0; 
            playSong(); 
        }
        return; 
    }

    let nextIndex = songIndex;
    let attempts = 0;
    let foundPlayable = false;

    // Loop to find next playable track
    while (attempts < songs.length) {
        // Calculate next index based on mode
        if (playMode === 1 || playMode === 2) {
            // Shuffle
            let rand;
            do { rand = Math.floor(Math.random() * songs.length); } 
            while (rand === nextIndex && songs.length > 1);
            nextIndex = rand;
        } else {
            // Normal Order
            nextIndex++;
            if (nextIndex > songs.length - 1) {
                if (playMode === 3) nextIndex = 0; // Loop All
                else return; // Stop at end
            }
        }

        // CHECK: Does this song have audio?
        if (songs[nextIndex].src && songs[nextIndex].src !== "") {
            foundPlayable = true;
            break; // Found one! Stop looking.
        }
        
        attempts++;
    }

    if (foundPlayable) {
        songIndex = nextIndex;
        loadSong(songs[songIndex]);
        playSong();
    } else {
        // If we looped through everything and found nothing
        console.log("No playable songs found in queue.");
        pauseSong();
    }
}

function prevSong() {
    // Strict Repeat One
    if (playMode === 4) { 
        if (songs[songIndex].src) { audio.currentTime = 0; playSong(); }
        return; 
    }

    // Normal Restart Rule
    if (audio.currentTime > 3) { 
        audio.currentTime = 0; 
        return; 
    } 
    
    let prevIndex = songIndex;
    let attempts = 0;
    let foundPlayable = false;

    // Loop BACKWARDS to find playable track
    while (attempts < songs.length) {
        prevIndex--;
        if (prevIndex < 0) prevIndex = songs.length - 1;

        // CHECK: Audio exists?
        if (songs[prevIndex].src && songs[prevIndex].src !== "") {
            foundPlayable = true;
            break;
        }
        attempts++;
    }

    if (foundPlayable) {
        songIndex = prevIndex;
        loadSong(songs[songIndex]);
        playSong();
    }
}

// --- 6. EVENT LISTENERS ---
menuBtn.addEventListener('click', () => {
    playMode++; if (playMode > 4) playMode = 0;
    iconShuffle.classList.add('hidden'); iconRepeat.classList.add('hidden'); iconRepeat1.classList.add('hidden');
    switch (playMode) {
        case 1: iconShuffle.classList.remove('hidden'); playerAlbum.innerText = "Mode: Shuffle"; break;
        case 2: iconShuffle.classList.remove('hidden'); iconRepeat.classList.remove('hidden'); playerAlbum.innerText = "Mode: Endless"; break;
        case 3: iconRepeat.classList.remove('hidden'); playerAlbum.innerText = "Mode: Loop All"; break;
        case 4: iconRepeat1.classList.remove('hidden'); playerAlbum.innerText = "Mode: Loop One"; break;
        default: playerAlbum.innerText = "Mode: Normal"; break;
    }
    setTimeout(() => { playerAlbum.innerText = songs[songIndex]?.album || 'Unknown'; }, 1500);
});

playBtn.addEventListener('click', () => isPlaying ? pauseSong() : playSong());
centerBtn.addEventListener('click', () => isPlaying ? pauseSong() : playSong());
nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);
audio.addEventListener('timeupdate', (e) => {
    const { duration, currentTime } = e.srcElement;
    if (duration) {
        progressBar.style.width = `${(currentTime / duration) * 100}%`;
        let dm = Math.floor(duration/60), ds = Math.floor(duration%60), cm = Math.floor(currentTime/60), cs = Math.floor(currentTime%60);
        totalTimeEl.innerText = `${dm}:${ds < 10 ? '0'+ds : ds}`;
        currTimeEl.innerText = `${cm}:${cs < 10 ? '0'+cs : cs}`;
    }
});
audio.addEventListener('ended', nextSong);
progressBarContainer.addEventListener('click', (e) => {
    audio.currentTime = (e.offsetX / progressBarContainer.clientWidth) * audio.duration;
});

// --- 7. START ---
fetchSongs();

// --- DARK MODE TOGGLE ---
const themeBtn = document.getElementById('theme-toggle-btn');

// Check if user already chose dark mode
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeBtn.innerHTML = '<i class="fas fa-sun"></i>'; // Switch icon to Sun
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        localStorage.setItem('theme', 'light');
        themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
});