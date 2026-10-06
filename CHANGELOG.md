# Changelog

## 0.3.0

### New

- **Loop a section:** Shift+drag across the waveform to loop it; drag the edges to adjust.
- **Markers:** press M to drop a marker at the playhead. Click to jump, double-click to rename.
- **Smart playlists:** rule-based playlists (genre, artist, BPM, year, length, tags, loved and more) that update as your library changes.
- **Key detection:** turn on the Key column to detect each track’s musical key, shown in Camelot notation (e.g. 8A · Am).
- **Play Next and Play Later** in the track menu.
- **Sleep timer:** stop playback after 15–90 minutes or at the end of the track.
- **Playback speed** from 0.5× to 2×, with an option to keep the original pitch.
- **Duplicate finder** in Settings → Library lists tracks you have more than once.
- **Window corner radius** setting in Appearance. Thanks @wex288! ([#17](https://github.com/edinabazi/playhead/issues/17))
- **Search the current folder or playlist:** press Tab in search to switch scope. Thanks @wex288! ([#22](https://github.com/edinabazi/playhead/issues/22))
- **SoundCloud playlists:** drag tracks onto your SoundCloud playlists (hold Option to move), remove and reorder tracks, and create, rename or delete playlists. Thanks @portrgent! ([#29](https://github.com/edinabazi/playhead/issues/29))
- **SoundCloud search:** press Tab in search to find tracks on SoundCloud.
- **SoundCloud comments** appear along the waveform, pop up as they play, and you can post your own.
- **Optional SoundCloud extras** in Settings → Integrations: sync hearts with SoundCloud likes, and keep playing similar tracks when the queue ends.

### Improved

- Volume normalization uses ReplayGain tags when files have them. Your library rescans once after updating to read them.
- The equalizer moved to the top-right controls, and their tooltips now appear below.
- Clicking anywhere outside the equalizer or column picker closes it. Thanks @wex288! ([#24](https://github.com/edinabazi/playhead/issues/24))
- Column resize handles show a resize cursor. Thanks @wex288! ([#23](https://github.com/edinabazi/playhead/issues/23))
- Removed the redundant “Track no.” column option. Thanks @wex288! ([#26](https://github.com/edinabazi/playhead/issues/26))
- Tooltips near the window edge are no longer cut off. Thanks @wex288! ([#27](https://github.com/edinabazi/playhead/issues/27))
- A little more space between the track list header and the first track.

### Fixed

- High CPU and GPU use while idle before anything was played. Thanks @wex288! ([#21](https://github.com/edinabazi/playhead/issues/21))
- “Remember playback position” now resumes tracks where you left off. Thanks @wex288! ([#25](https://github.com/edinabazi/playhead/issues/25))
- AIFF files now play instead of being skipped. Thanks @portrgent! ([#28](https://github.com/edinabazi/playhead/issues/28))
- SoundCloud and Last.fm could sign you out when many requests ran at once.
- A SoundCloud sign-in that never completed could get stuck; it can now be cancelled and expires on its own.

## 0.2.7

- Fixed “Install update and restart” hiding the window instead of restarting Playhead.
- Remember window size and position after quitting. Thanks @wex288! ([#15](https://github.com/edinabazi/playhead/issues/15))
- Click the playing cover or press Cmd/Ctrl+J to reveal and select the current song. Thanks @wex288! ([#16](https://github.com/edinabazi/playhead/issues/16))
- Keep keyboard selection visible as you navigate tracks. Thanks @wex288! ([#18](https://github.com/edinabazi/playhead/issues/18))
- Fixed automatic playback skipping the next song. Thanks @wex288! ([#19](https://github.com/edinabazi/playhead/issues/19))
- Remove deleted files during folder watching, rebuilds, and launch rescans. Thanks @wex288! ([#20](https://github.com/edinabazi/playhead/issues/20))

## 0.2.6

- Customizable, resizable track columns with metadata sorting. Thanks @stripedgoat! ([#14](https://github.com/edinabazi/playhead/issues/14))
- Embedded and `.lrc` lyrics with synced highlighting and click-to-seek. Thanks @reviewlord! ([#9](https://github.com/edinabazi/playhead/issues/9))
- More reliable network-drive playback with automatic recovery and **Retry**. Thanks @steamfan! ([#7](https://github.com/edinabazi/playhead/issues/7))
- Removed library scan limits; added progress, cancellation, and faster browsing and folder watching. Thanks @andreschoppe! ([#8](https://github.com/edinabazi/playhead/issues/8))

## 0.2.5

### New

- Browse nested folders in a collapsible sidebar tree. Turn on **Show subfolders** in Library settings; it is off by default.
- Shape your sound with a 10-band equalizer, preamp, and presets for quiet listening, bass, and vocals.
- Enable volume boost for up to 200% volume, with output peak protection.
- Show stereo level meters with peak hold from the player’s **Levels** button.

### Improved

- Smoother playback with less rendering work and lower CPU use.
- Smoother folder expansion, better keyboard navigation, and faster handling of large folder trees.
- More reliable EQ preset saving and restoration, with clearer keyboard focus and control tooltips.
- Accurate meter peak capture without changing the sound; meter processing stops when closed, hidden, or paused.
- Playback animations now respond immediately to changes in Reduce Motion.

Thanks to @simplaerai-sv for the contributions in #10, #11, #12, and #13.
