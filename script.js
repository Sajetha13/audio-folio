// --- 1. SETUP SUPABASE ---
// I have inserted your keys here. DO NOT CHANGE THESE LINES.
const SUPABASE_URL = 'https://qqmmokdalfzozgoawigs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbW1va2RhbGZ6b3pnb2F3aWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2OTE2NjcsImV4cCI6MjA4MDI2NzY2N30.oKYOpuYrB5la8izoLk1YNidSKrRBL6znNKFfUpcriNE';

// Initialize Client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let songs = []; // Empty start, we fill this from DB
let playQueue = [];   // The Current Playing Queue (Changes based on what you click)
let queueIndex = 0;   // Where we are in the CURRENT queue
let isShuffle = false;

async function fetchSongs() {
    console.log("Fetching library...");

    // 1. Fetch Songs from Supabase
    // We sort by 'popular_order' ASCENDING (1, 2, 3...)
    const { data: songData, error: songError } = await db
        .from('songs')
        .select('*')
        .order('popular_order', { ascending: true }); // <--- CHANGED TO POPULAR_ORDER

    // 2. Fetch Playlists
    const { data: playlistData, error: plError } = await db
        .from('playlists')
        .select('*');

    if (songError || plError) {
        console.error("Error:", songError || plError);
        return;
    }

    // 3. Map the raw data
    songs = songData.map(item => ({
        title: item.title,
        artist: item.artist,
        album: item.album,
        type: item.type,
        year: item.year,
        duration: item.duration,
        src: item.mp3_url,
        cover: item.cover_url,
        // We map your new column here:
        popularOrder: item.popular_order || 999, 
        description: item.description,
        lyrics: item.lyrics,
        trackOrder: item.track_order || 0
    }));

    if (playlistData) playlists = playlistData;

    // --- NEW QUEUE LOGIC ---
    if (songs.length > 0) {
        // Since Supabase already sorted them by popular_order (1, 2, 3...),
        // Our queue is simply the list of songs!
        playQueue = [...songs];
        queueIndex = 0;

        loadSong(playQueue[0]);
        renderHome();
        updateLyricsPanel(playQueue[0]);
    }
}

// --- 3. STANDARD VARIABLES ---
const audio = new Audio();
let songIndex = 0;
let isPlaying = false;
let playMode = 0; 
let playlists = [];
let currentContext = null; // Tracks if we are playing 'album' or 'playlist' context

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

    // Take the Top 8 songs based on your ranking
    const popularSongs = songs.slice(0, 8); 
    const releases = getUniqueReleases(); 

    container.innerHTML = `
        <div style="padding-bottom: 50px;">
            <h1 class="zz-title">ZIPPIYZAP’S AUDIOFOLIO</h1>
            <p class="zz-subtitle">Lyrics, melodies and other tragedies</p>
            <div class="zz-artist">Zephy <i class="fas fa-check-circle" style="color: #007aff;"></i></div>
            <div class="zz-controls">
                <span onclick="playAll()">Play</span> | <span onclick="toggleShuffle()">Shuffle</span>
            </div>

            <h2 class="zz-section-title">Favorites</h2>
            
            <ul class="zz-popular-list">
                ${popularSongs.map((song, i) => `
                    <li class="zz-row" onclick="playSpecificSong('${song.title.replace(/'/g, "\\'")}')">
                        <div class="zz-row-left">
                            <span class="row-num" style="color:#333; font-size:13px; font-weight:500; width:20px;">${i + 1}</span> 
                            <span>${song.title}</span>
                        </div>
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
                    <div class="zz-card" onclick="renderAlbumView('${release.name.replace(/'/g, "\\'")}')">
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
                <div class="zz-about-text">
                    <p style="font-weight: 500; font-size: 15px; margin-bottom: 10px;">
                        Writing the soundtrack for the main character moments you’re too scared to admit you’re having. Welcome to the archives.
                    </p>
                    <p style="font-style: italic; color: #666; font-size: 14px;">
                        "if it doesn't crush us, then we don't want it."
                    </p>
                </div>
            </div>
            
            ${playlists.length > 0 ? `<br><h2 class="zz-section-title">Artist Playlists</h2><div class="zz-grid">${playlists.map(pl => `<div class="zz-card" onclick="renderPlaylistView('${pl.title.replace(/'/g, "\\'")}')"><div class="zz-cover-placeholder"><img src="${pl.cover_url || 'https://via.placeholder.com/150'}" style="width:100%; height:100%; object-fit:cover;"></div><h4>${pl.title}</h4><p>${pl.description || 'By Zephy'}</p></div>`).join('')}</div>` : ''}
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
        .sort((a, b) => (a.trackOrder || 0) - (b.trackOrder || 0));

    // SAFE ESCAPE for Album Name
    const safeAlbumName = release.name.replace(/'/g, "\\'");

    return `
    <div class="zz-release-container">
        <div class="zz-release-header">
            <img src="${release.cover}" class="release-cover">
            <div class="release-info">
                <span class="release-type">${release.type}</span>
                <div class="release-title">${release.name}</div>
                <div class="release-meta">
                    <button class="play-btn-black" onclick="playAlbum('${safeAlbumName}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <span>${release.year} • ${tracks.length} Songs</span>
                </div>
            </div>
        </div>

        <ul class="zz-track-list">
            ${tracks.map((song, i) => `
                <li class="zz-track-row" onclick="playSpecificSong('${song.title.replace(/'/g, "\\'")}')">
                    <span class="track-idx">${i + 1}</span>
                    <span class="track-name">${song.title}</span>
                    <span class="track-time">${song.duration}</span>
                </li>
            `).join('')}
        </ul>
    </div>
    `;
}

// Fisher-Yates Shuffle Algorithm (The Industry Standard)
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

// --- HELPER: Play Album Context (Smart Toggle) ---
function playAlbum(albumName) {
    // 1. Check if we are ALREADY playing this album
    if (currentContext === `album:${albumName}`) {
        if (isPlaying) pauseSong();
        else playSong();
        return; // Stop here, don't reload!
    }

    // 2. Prepare Queue
    const albumTracks = songs
        .filter(s => s.album === albumName)
        .sort((a, b) => (a.trackOrder || 0) - (b.trackOrder || 0));

    if (albumTracks.length === 0) return;

    // 3. Set Context & Queue
    currentContext = `album:${albumName}`;
    playQueue = albumTracks;
    queueIndex = 0;
    isShuffle = false; 

    // 4. Play
    console.log(`Context locked to Album: ${albumName}`);
    loadSong(playQueue[queueIndex]);
    playSong();
}

// Helper to restore order based on where we are (Album vs Home)
function restoreQueueOrder() {
    if (currentContext && currentContext.startsWith('album:')) {
        const albumName = currentContext.split('album:')[1];
        playQueue = songs.filter(s => s.album === albumName)
                         .sort((a, b) => (a.trackOrder || 0) - (b.trackOrder || 0));
    } 
    else if (currentContext && currentContext.startsWith('playlist:')) {
        const plTitle = currentContext.split('playlist:')[1];
        const pl = playlists.find(p => p.title === plTitle);
        if (pl) playQueue = songs.filter(s => pl.songs.includes(s.title));
    } 
    else {
        // Default Home: Popular + Others
        const popularOnes = songs.filter(s => s.isPopular);
        const others = songs.filter(s => !s.isPopular);
        playQueue = [...popularOnes, ...others];
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

// Logic for playing a specific song from a list click
function playSpecificSong(title) {
    // If we are just clicking a song from the "Show All" or "Home" list,
    // we usually want to play that song, and then continue with the CURRENT queue
    // OR reset the queue to the master list starting from that song.
    
    // For simplicity: Let's find the song in the CURRENT queue.
    let idx = playQueue.findIndex(s => s.title === title);

    if (idx !== -1) {
        // It's in the current queue (e.g. inside the album we are viewing)
        queueIndex = idx;
    } else {
        // It's not in the current queue (e.g. we clicked a popular song while inside an album view)
        // Reset queue to All Songs (prioritizing popular) or just find it in master
        // This prevents the "Context Leak"
        playQueue = songs; // Reset to master list
        queueIndex = songs.findIndex(s => s.title === title);
    }
    // --- NEW: Safety Check ---
    const songToPlay = playQueue[queueIndex];
    loadSong(songToPlay);
    
    // Only play if there is actually audio!
    if(songToPlay.src && songToPlay.src !== "") {
        playSong();
    } else {
        console.log("Clicked song has no audio (Lyrics Only).");
        // We loaded the lyrics, but we don't start the player.
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
    const safePlTitle = playlist.title.replace(/'/g, "\\'");

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
                            <button class="play-btn-black" onclick="playPlaylist('${safePlTitle}')">
                                <i class="fas fa-play"></i>
                            </button>
                            <span>${playlist.description} • ${playlistTracks.length} Songs</span>
                        </div>
                    </div>
                </div>

                <ul class="zz-track-list">
                    ${playlistTracks.map((song, i) => `
                        <li class="zz-track-row" onclick="playSpecificSong('${song.title.replace(/'/g, "\\'")}')">
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
    // 1. Check if we are ALREADY playing this playlist
    if (currentContext === `playlist:${playlistTitle}`) {
        if (isPlaying) pauseSong();
        else playSong();
        return;
    }

    const playlist = playlists.find(p => p.title === playlistTitle);
    if(!playlist) return;

    const playlistTracks = songs.filter(s => playlist.songs.includes(s.title));
    if (playlistTracks.length === 0) return;

    // 2. Set Context & Queue
    currentContext = `playlist:${playlistTitle}`;
    playQueue = playlistTracks;
    queueIndex = 0;
    isShuffle = false;

    // 3. Play
    console.log(`Context locked to Playlist: ${playlistTitle}`);
    loadSong(playQueue[queueIndex]);
    playSong();
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
function toggleShuffle() {
    playMode = 1; // Force Shuffle Mode
    
    // 1. Randomize the Queue immediately
    // We use [...songs] to include ALL songs in the shuffle
    playQueue = shuffleArray([...songs]);
    
    // 2. Play the first song of the new random list
    queueIndex = 0;
    
    console.log("Shuffle Link Clicked: Playing random song...");
    loadSong(playQueue[queueIndex]);
    playSong();

    // 3. Update Icons
    iconShuffle.classList.remove('hidden');
    iconRepeat.classList.add('hidden');
    iconRepeat1.classList.add('hidden');
    playerAlbum.innerText = "Mode: Shuffle";
}

function playAll() { 
    playMode = 0; // Force Normal Mode
    currentContext = 'all'; 
    
    // 1. Reset Queue to Normal (Popular First)
    const popularOnes = songs.filter(s => s.isPopular);
    const others = songs.filter(s => !s.isPopular);
    playQueue = [...popularOnes, ...others];
    
    // 2. Play first song
    queueIndex = 0; 
    loadSong(playQueue[0]); 
    playSong(); 

    // 3. Update Icon visibility
    iconShuffle.classList.add('hidden');
    iconRepeat.classList.add('hidden');
    iconRepeat1.classList.add('hidden');
}

// --- PLAYER LOGIC (Smart Skip) ---

function nextSong() {
    // MODE 4: REPEAT ONE (Loop One Song Forever)
    if (playMode === 4) {
        audio.currentTime = 0;
        playSong();
        return;
    }

    // Move to next index
    queueIndex++;

    // CHECK IF QUEUE FINISHED
    if (queueIndex >= playQueue.length) {
        
        if (playMode === 2) {
            // MODE 2: ENDLESS (Shuffle + Repeat)
            // Reshuffle the current queue to get a new order
            playQueue = shuffleArray(playQueue);
            queueIndex = 0; // Start new random order
            console.log("Endless Mode: Reshuffling...");
            loadSong(playQueue[queueIndex]);
            playSong();
            return;

        } else if (playMode === 3) {
            // MODE 3: LOOP ALL (Repeat Album in Order)
            queueIndex = 0; // Go back to start
            console.log("Loop All: Restarting queue...");
            loadSong(playQueue[queueIndex]);
            playSong();
            return;

        } else {
            // MODE 0 or 1: Stop at end
            console.log("End of Queue.");
            pauseSong();
            return;
        }
    }

    // NORMAL NEXT SONG
    const nextTrack = playQueue[queueIndex];

    // Check Audio exists
    if (nextTrack.src && nextTrack.src !== "") {
        loadSong(nextTrack);
        playSong();
    } else {
        console.log("Skipping lyrics-only track...");
        nextSong(); // Recursion to skip
    }
}

function prevSong() {
    // Standard restart logic
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }

    queueIndex--;
    if (queueIndex < 0) {
        queueIndex = 0; // Don't loop to back, just stay at start
    }
    
    loadSong(playQueue[queueIndex]);
    playSong();
}


// --- 6. EVENT LISTENERS ---
menuBtn.addEventListener('click', () => {
    // 1. Cycle Mode
    playMode++; 
    if (playMode > 4) playMode = 0;

    // 2. Hide all icons first (we'll show the right one below)
    iconShuffle.classList.add('hidden'); 
    iconRepeat.classList.add('hidden'); 
    iconRepeat1.classList.add('hidden');

    // 3. HANDLE QUEUE ORDER BASED ON MODE
    if (playMode === 1 || playMode === 2) {
        // === SHUFFLE OR ENDLESS ===
        // We need to randomize the queue immediately!
        
        const currentSong = playQueue[queueIndex]; // Remember current song
        
        // If we are in an album, shuffle THAT album. If Home, shuffle ALL.
        let songsToShuffle = [];
        if (currentContext && currentContext.startsWith('album:')) {
            const albumName = currentContext.split('album:')[1];
            songsToShuffle = songs.filter(s => s.album === albumName);
        } else if (currentContext && currentContext.startsWith('playlist:')) {
             const plTitle = currentContext.split('playlist:')[1];
             const pl = playlists.find(p => p.title === plTitle);
             if (pl) songsToShuffle = songs.filter(s => pl.songs.includes(s.title));
        } else {
            songsToShuffle = [...songs];
        }

        playQueue = shuffleArray(songsToShuffle);

        // Find current song in new mess so we don't skip it
        if(currentSong) {
            let newIdx = playQueue.findIndex(s => s.title === currentSong.title);
            queueIndex = newIdx !== -1 ? newIdx : 0;
        }

        iconShuffle.classList.remove('hidden');
        if (playMode === 2) iconRepeat.classList.remove('hidden'); // Endless has both icons
        playerAlbum.innerText = (playMode === 1) ? "Mode: Shuffle" : "Mode: Endless";

    } else {
        // === NORMAL, LOOP ALL, OR REPEAT ONE ===
        // We need to restore the correct order (1, 2, 3...)
        
        const currentSong = playQueue[queueIndex];
        restoreQueueOrder(); // Call the helper from Part 1
        
        // Find current song in the sorted list
        if(currentSong) {
            let newIdx = playQueue.findIndex(s => s.title === currentSong.title);
            queueIndex = newIdx !== -1 ? newIdx : 0;
        }

        if (playMode === 3) iconRepeat.classList.remove('hidden');
        if (playMode === 4) iconRepeat1.classList.remove('hidden');
        
        playerAlbum.innerText = (playMode === 3) ? "Mode: Loop All" : 
                                (playMode === 4) ? "Mode: Loop One" : "Mode: Normal";
    }

    // Reset text after 1.5s
    setTimeout(() => { playerAlbum.innerText = playQueue[queueIndex]?.album || 'Unknown'; }, 1500);
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