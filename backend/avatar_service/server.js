const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

app.use('/videos', express.static(path.join(__dirname, 'public/videos')));

const videosDir = path.join(__dirname, 'public/videos');
const clipsDir = path.join(__dirname, 'clips');

if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true });

// We also need a temp dir for the clips.txt files used by FFmpeg
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'avatar' });
});

// Helper to map text token to available clip, or fallback to letters
function getClipPaths(text) {
    const tokens = text.trim().toUpperCase().split(/\s+/);
    let paths = [];

    for (const token of tokens) {
        const wordPath = path.join(clipsDir, `${token.toLowerCase()}.webm`);
        if (fs.existsSync(wordPath)) {
            paths.push(wordPath);
        } else {
            // Fallback to spelling it out letter by letter
            for (const char of token) {
                // Ignore non-alphabetic chars
                if (char.match(/[A-Z]/)) {
                    const charPath = path.join(clipsDir, `${char.toLowerCase()}.webm`);
                    if (fs.existsSync(charPath)) {
                        paths.push(charPath);
                    }
                }
            }
        }
    }
    return paths;
}

app.post('/generate-sign-video', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text input is required' });
        }

        console.log(`[API] Processing text for FFmpeg: "${text}"`);

        const clipPaths = getClipPaths(text);
        if (clipPaths.length === 0) {
            return res.status(404).json({ error: 'No matching clips found for the given text' });
        }

        const videoId = uuidv4();
        const listFilename = path.join(tempDir, `${videoId}.txt`);
        const outputFilename = `${videoId}.webm`;
        const outputPath = path.join(videosDir, outputFilename);

        // Write the clips.txt file format for FFmpeg concat demuxer
        // Forward slashes work best for FFmpeg even on Windows
        const listContent = clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join('\n');
        fs.writeFileSync(listFilename, listContent, 'utf-8');

        console.log(`[API] Stitching ${clipPaths.length} clips...`);

        // Run FFmpeg: ffmpeg -f concat -safe 0 -i clips.txt -c copy output.webm
        const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${listFilename}" -c copy "${outputPath}"`;

        exec(ffmpegCmd, (error, stdout, stderr) => {
            // Clean up the text file
            if (fs.existsSync(listFilename)) {
                fs.unlinkSync(listFilename);
            }

            if (error) {
                console.error('[API] FFmpeg Error:', stderr);
                return res.status(500).json({ error: 'Video stitching failed', details: stderr });
            }

            console.log(`[API] Video generated instantly at ${outputPath}`);
            const videoUrl = `${req.protocol}://${req.get('host')}/videos/${outputFilename}`;

            res.status(200).json({
                status: "success",
                video_url: videoUrl,
                format: "webm"
            });
        });

    } catch (error) {
        console.error('[API] Server error:', error);
        res.status(500).json({ error: 'Server failure', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend API running effortlessly on port ${PORT}`);
});
