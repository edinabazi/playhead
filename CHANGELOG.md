# Changelog

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
