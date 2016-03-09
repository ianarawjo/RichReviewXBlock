/**
 * @name Speak API r2.speak
 * @description =======
 *
 * Controller which maintains text-to-audio
 * correspondence across edits of a transcript.
 *
 * ====================
 * @author Created by ian on 02/25/16
 * @namespace r2
 */
(function(r2) {
    "use strict";

    /**
     * @module r2.speak
     */
    r2.speak = (function() {
        var pub_speak = {};

        /**
         * An instance of Newspeak's text-to-audio controller.
         */
        pub_speak.controller = () => {
            var pub = {};

            var base = [];
            var ops = [];
            var edited = [];
            var _needscompile = false;
            var _stitching = false;

            // Internal utils
            var utils = {
                /** Inserts a2 into a1 at index.
                 *  See http://stackoverflow.com/a/7032717. */
                injectArray : (a1, a2, index) => {
                    a1.splice.apply(a1, [index, 0].concat(a2));
                }
            };

            // Internal data structures
            var Audio = (function() {
                var AudioResource = class AudioResource {
                    constructor(url, blob) {
                        this.url = url; // TODO: Cloud storage.
                        this.blob = blob;
                    }
                    play(start_time) {
                        if (typeof start_time === "undefined") start_time = 0;
                        var url = this.url;
                        return new Promise(function(resolve, reject) {
                            r2.audioPlayer.play(Math.random() * 10, url,
                              start_time * 1000.0, undefined, function () {
                                // .. Called when stopped playing .. //
                                resolve(true);
                            });
                        });
                    }
                };
                var resources = [];
                return {
                    for : function(url, blob) {
                        if (url in resources) return resources[url];
                        else {
                            var r = new AudioResource(url, blob);
                            resources[url] = r;
                            return r;
                        }
                    },
                    stitch : function(talkens) { // Returns stitched audio resource as a Promise.
                        return r2.audiosynth.stitch(talkens).then(function(rsc) {
                            var url = rsc.url; var blob = rsc.blob;
                            return new Promise(function(resolve, reject) {
                                if (!url) reject("Audio.stitch: Null url.");
                                else resolve(Audio.for(url, blob));
                            });
                        });
                    },
                    synthesize : function(talkens, options) {
                        return r2.audiosynth.synthesize(talkens, { mode:'TTS', transfer:options }).then(function(rsc) {
                            var url = rsc.url; var blob = rsc.blob;
                            return new Promise(function(resolve, reject) {
                                if (!url) reject("Audio.synthesize: Null url.");
                                else resolve(Audio.for(url, blob));
                            });
                        });
                    }
                };
            }());
            var EditType = {
                UNCHANGED : 0,
                INS : 1, // insertion
                DEL : 2, // deletion
                REPL: 3, // replace
                UNKNOWN : 4
            };
            class EditOp {
                constructor(txt, edit_type) {
                    this.text = txt;
                    this.type = edit_type;
                }

                // Parse HTML array into array of EditOp segments:
                /**
                 * Given HTML output from jsdiff, generates array of EditOps
                 * corresponding to the differential edits detected.
                 * @param  {string} diff - output of jsdiff diffString(o, n)
                 * @return {[EditOp]}    - an Array of EditOp's
                 */
                static generate(diff) {

                    // Split html by tags
                    // * Thanks Dalorzo @ SO http://stackoverflow.com/a/25462610. *
                    var htmlTagRegex =/\s*(<[^>]*>)/g;
                    var html = diff.split(htmlTagRegex);

                    // Create EditOp's
                    var es = [];
                    var et = EditType.UNKNOWN;
                    var end_tag = false;
                    for (var s of html) {
                        if (s.length === 0) continue;
                        else if (end_tag) {
                            end_tag = false;
                            continue;
                        }
                        else if (et !== EditType.UNKNOWN) {
                            es.push(new EditOp(s, et));
                            et = EditType.UNKNOWN;
                            end_tag = true;
                        }
                        else if (s === '<del>') et = EditType.DEL;
                        else if (s === '<ins>') et = EditType.INS;
                        else {
                            var words = s.trim().split(/\s+/);
                            words.forEach(function(wrd) {
                                es.push(new EditOp(wrd, EditType.UNCHANGED));
                            });
                        }
                    }

                    // Second-pass: Replacing DEL-INS back-to-backs with REPLACE.
                    // * Makes our jobs a bit easier later. *
                    var e;
                    for (var i = 0; i < es.length-1; i++) {
                        if (es[i].type === EditType.DEL && es[i+1].type === EditType.INS) {
                            es.splice(i, 2, new EditOp(es[i+1].text, EditType.REPL));
                            i--;
                        }
                    }

                    return es;
                }
            }
            class Talken {
                constructor(wrd, bgn, end, audioRsc) {
                    this.word = wrd;
                    this.bgn = bgn;
                    this.end = end;
                    this.audio = audioRsc;
                }
                replaceWord(txt) {
                    this.word = txt;
                }
                static generate(timestamps, audioURL) {
                    var talkens = [];
                    var audio = Audio.for(audioURL);
                    for (let t of timestamps) {
                        talkens.push(new Talken(t[0], t[1], t[2], audio));
                    }
                    return talkens;
                }
                static clone(t) {
                    if (t instanceof Talken) return new Talken(t.word, t.bgn, t.end, t.audio);
                    else if (t instanceof Array) return t.map((tn) => new Talken(tn.word, tn.bgn, tn.end, tn.audio));
                    else {
                        console.log("Error @ Talken.clone: Object is not instance of Talken or Array!", t);
                        return null;
                    }
                }
                clone() { return Talken.clone(this); }
            }

            /**
             * Compiles the transcript for the given talkens.
             * @return {string} The compiled transcript.
             */
            var transcript = (talkens) => {
                return talkens.map((talken) => talken.word).join(' ');
            };
            var base_transcript = () => transcript(base);

            /**
             * Inserts timestamp data at index. This is
             * not counted as an 'edit' operation.
             * @param  {int} index            The insertion position in the base transcript, as a word index. (e.g. 1 for 'hello Watson' => 'hello IBM Watson')
             * @param  {[timestamp]} ts       The timestamp data with transcript information.
             * @param  {string} audioURL      The audio that the timestamps refer to.
             * @return {bool}                 Success or failure.
             */
            pub.insertVoice = (index, ts, audioURL) => {

                if (ts.length === 0) {
                    console.log("Error @ voiceInsert: Nothing to insert.");
                    return false;
                }

                // Generate talkens for timestamps and audioURL
                var talkens = Talken.generate(ts, audioURL);

                // Check that idx is valid
                if (index > base.length || index < 0) {
                    console.log("Error @ voiceInsert: Invalid index " + index + ".");
                    return false;
                } else if (talkens.length === 0) {
                    console.log("Error @ voiceInsert: No talkens generated.");
                    return false;
                }

                // Insert talkens at index in list of stored talkens
                utils.injectArray(base, talkens, index);

                _needscompile = true;
                return true;
            };

            /* Command stack operations */
            var clipboard = null;
            var Stack = function() {
                var stack = [];
                return {
                    record: () => this.push(base),
                    push: (ts) => stack.push(ts),
                    pop: () => stack.pop(),
                    clear: () => stack = []
                };
            };
            var undostack = new Stack();
            var redostack = new Stack();
            pub.undo = () => {
                if (undostack.length === 0) return;
                redostack.record();
                var prev_ts = undostack.pop();
                base = prev_ts;
                _needscompile = true;
            };
            pub.redo = () => {
                if (redostack.length === 0) return;
                undostack.record();
                var next_ts = redostack.pop();
                base = next_ts;
                _needscompile = true;
            };
            pub.remove = (start_idx, len) => {
                undostack.record();
                redostack.clear();
                if (start_idx < 0 || start_idx + len > base.length) {
                    console.warn("r2.speak.remove: Incorrect range.");
                    return false; }
                base.splice(start_idx, len);
                _needscompile = true;
                return true;
            };
            pub.cut = (start_idx, len) => {
                undostack.record();
                redostack.clear();
                if (start_idx < 0 || start_idx + len > base.length) {
                    console.warn("r2.speak.cut: Incorrect range.");
                    return false; }
                clipboard = Talken.clone(base.slice(start_idx, start_idx + len)); // deep copy of subarray
                return this.remove(start_idx, len);
            };
            pub.paste = (start_idx) => {
                undostack.record();
                redostack.clear();
                if (start_idx > base.length) {
                    console.log("r2.speak.parse: caution: start index past length of array.", start_idx);
                    start_idx = base.length;
                }
                if (!clipboard) {
                    console.warn("r2.speak.paste: Nothing in clipboard.");
                    return false; }
                base.splice(start_idx, 0, Talken.clone(clipboard));
                _needscompile = true;
                return true;
            };

            /**
             * Update transcript model with edits made by user.
             * TODO: Move edit graph update elsewhere.
             * @param  {string} transcript The new transcript || an edit graph on the base transcript.
             */
            pub.update = (new_transcript) => {

                var bt = base_transcript();

                // Calculate diff between base and new transcript
                // *** REQUIRES jsdiff.js ***
                var diff = diffString(bt, new_transcript);
                if (diff === bt) return; // Nothing changed.

                // Generate array of EditOp's
                var edits = EditOp.generate(diff);

                // Store
                ops = edits;

                _needscompile = true;

            };

            pub.updateSimpleSpeech = (editHistory) => {
                var bs = Talken.clone(base);
                edited = editHistory.apply(bs, function(op) {
                    return new Talken(op.word, 0, 0, null);
                });

                console.log('Base w/ edit graph applied: ', edited);

                _needscompile = false;
                ops = []; // compile does nothing now.
            };

            /*
                Takes talkens and a sequence EditOp operations on those
                talkens, and returns a new talken array with edit operations applied.
                NOTE: If you pass nothing, it'll compile on r2.speak variables base and ops.
                NOTE: If you just pass talkens, it'll try to use stored edit operations from update().
             */
            pub.compile = () => {
                if (!_needscompile) return; // nothing to do!
                edited = _compile(base, ops);
                console.log('edited: ', edited);
                _needscompile = false;
            };
            var _compile = (talkens, edits) => {

                var ts = Talken.clone(talkens);

                // Trivial cases
                if (ts.length === 0 || edits.length === 0)
                    return ts;

                var checkmatch = (e, t) => { // logging function
                    if (e.text !== t.word) {
                        console.log("Error @ ETC.update: Deleted word '" + e.text + "' doesn't match word '" + t.word + "' in prev transcript.");
                        return false; }
                    return true;
                };

                // Loop through edits, performing one at a time
                var j = 0;
                for (var i = 0; i < edits.length; i++) {
                    var e = edits[i];

                    if (e.type === EditType.REPL) {

                        // We call a function here that we'll specify
                        // later... If text is
                        ts[j].replaceWord(e.text);

                    } else if (e.type === EditType.DEL) {
                        checkmatch(e, ts[j]); // the word of the deleted talken should match the word deleted in the edit

                        // At index j remove 1 talken.
                        ts.splice(j, 1);

                        j--;
                    } else if (e.type === EditType.INS) {

                        // At index j insert a new talken.
                        // NOTE: We don't know what the audio is yet, so we pass null.
                        // This should flag the synthesis func that we need audio
                        // for this talken before stitching can take place.
                        ts.splice(j, 0, new Talken(e.text, 0, 0, null));

                        j++; // skip over the inserted talken
                    } else checkmatch(e, ts[j]); // nothing better have changed!

                    j++;
                }

                return ts;
            };

            /** Audio Operations */
            /**
             * Render the audio.
             * @param  {int} idx           - The index of the talken to begin playing at. Defaults to 0.
             * @return {Promise | null}    - On success, returns Promise containing URL to audio resource.
             */
            pub.renderAudio = () => {
                return _render('natural');
            };
            pub.renderAudioAnon = (idx) => {
                return _render('anon');
            };
            var _render = (mode) => {
                if (_stitching) {
                    console.warn("Error @ r2.speak.render: Audio is currently being stitched from a previous play() call. Please wait.");
                    return null;
                }
                if (!edited || edited.length === 0) {
                    console.warn("Error @ r2.speak.render: No compiled talkens found. Call compile() before play(), or insert a transcript.");
                    return null;
                } else if (mode !== 'natural' && mode !== 'anon') {
                    console.warn("Error @ r2.speak.render: Unrecognized mode.");
                    return null;
                }

                // Create clean copy of edited talkens, just in case.
                var talkens = Talken.clone(edited);

                // Since this is async call, we need to be
                // careful about calling 'play' again.
                _stitching = true;

                // Compile the audio
                var after_stitching = function(stitched_resource) {

                    console.log("stitched talkens: ", stitched_resource);

                    // Repair talken urls to point to stitched resource:
                    var _bgn = 0; // running time
                    talkens.forEach(function(t) {
                        var len = t.end - t.bgn;
                        t.bgn = _bgn;
                        t.end = _bgn + len;
                        t.audio = stitched_resource;
                        _bgn += len;
                    });

                    // Set edited talkens
                    edited = talkens;

                    // No longer stitching!
                    _stitching = false;

                    return new Promise(function(resolve, reject) {
                        resolve(stitched_resource);
                    });
                };

                if (mode === 'natural') {
                    return Audio.stitch(talkens).then(after_stitching).catch(function(err) {
                        console.warn("Error @ r2.speak.render: Audio stitch failed.", err);
                        _stitching = false;
                    });
                }
                else if (mode === 'anon') {
                    return Audio.synthesize(talkens, '').then(after_stitching).catch(function(err) {
                        console.warn("Error @ r2.speak.render: Audio stitch failed.", err);
                        _stitching = false;
                    });
                }
            };
            return pub;
        };

        return pub_speak;
    }());

    /**
     * @module r2.audiosynth
     * Operations on talken arrays.
     */
    r2.audiosynth = (function() {

        var pub = {};

        /** Helper function to convert talkens to timestamps in format [word, bgn, end].
         *  This will *not* skip over audioless talkens. Instead, it will save them with bgn, end as 0. */
        var toTimestamps = (talkens) => {
            var ts = [];
            talkens.forEach((t) => {
                if (typeof t.audio === "undefined" || !t.audio || !t.audio.url)
                    ts.push([ t.word, 0, 0 ]);
                else
                    ts.push([ t.word, t.bgn, t.end ]);
            });
            return ts;
        };

        /** Helper function to convert talkens to string transcript.
         *  This will *not* skip over audioless talkens. */
        var toTranscript = (talkens) => {
            var ts = '';
            talkens.forEach((t) => {
                ts += t.word + ' ';
            });
            return ts.trim();
        };

        /**
         * Generate transcript with SSML given transcript from text box (as edited array of talkens).
         * @param  {[Talken]} talkens - An array of (edited) talkens
         * @return {string}           - SSML transcript, to be sent to a speech synthesizer like IBM Watsom.
         */
        var toSSML = (talkens) => {
            var words = toTranscript(talkens).split(' ');
            var breaks = [];
            var wpms = {};

            if (words.length !== talkens.length) {
                console.log('Error: toSSML: Timestamp mismatch.', words.length, talkens.length, talkens);
                return "";
            }

            // Calculate breaks
            var prev_break_i = 0;
            var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.
            var PAUSE_MAX_MS = 1000; // cap pauses at a full second
            for (var i = 1; i < words.length; i++) {
                var word = words[i].replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g,""); // strip any punctuation (just in case)
                var ts = talkens[i];
                var prev_ts = talkens[i-1];

                if (ts.word != word) {
                    console.log('Error: toSSML: word in timestamp does not match displayed text.');
                    continue;
                }

                var pause_len_ms = Math.round((ts.bgn - prev_ts.end) * 1000.0); // current bgn - previous end
                if (pause_len_ms > PAUSE_THRESHOLD_MS) {
                    breaks.push(Math.min(pause_len_ms, PAUSE_MAX_MS));
                    prev_break_i = i;

                } else {
                    breaks.push(0);
                }
            }

            // Reconstruct text w/ SSML.
            var ssml = '';
            for (i = 0; i < words.length; i++) {
                var wrd = words[i];
                if (breaks[i] > 0 && i < words.length-1) {
                    ssml += wrd;
                    ssml += '<break time="' + breaks[i].toString() + 'ms"></break> ';
                } else
                    ssml += wrd + ' ';
            }

            return ssml;
        };

        /**
         * Get synthesized audio from IBM Watson.
         * @param  {string} ssml - Transcript as SSML
         * @return {Promise}     - Returns url to the TTS audio blob.
         */
        var getTTSAudioFromWatson = (ssml, voice) => {
            if (typeof voice === "undefined") voice = "en-US_MichaelVoice";

            var $dummy_ta = $('<textarea>');
            $dummy_ta.val(ssml);

            // TODO:
            // 0. Remove need for jQuery serialization call
            // 1. Abstract away from hardcoding the base app URL.
            // 2. Change from GET to POST request.
            // 3. Make voice (e.g. Michael) customizable!
            // 4. MAYBE: Split ssml into multiple chunks if it's long...
            var tts_audiourl = 'https://newspeak-tts.mybluemix.net/synthesize?text' + $.param($dummy_ta) + '&voice=' + voice + '&accept=audio/wav';
            console.log("Getting TTS from url ", tts_audiourl);

            // Request Watson TTS server
            return new Promise(function(resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', tts_audiourl, true);
                xhr.responseType = 'blob';
                xhr.onreadystatechange = function(e) {
                  if (this.readyState == 4 && this.status == 200) {
                    var blob = this.response;
                    resolve([URL.createObjectURL(blob), blob]);
                  }
                  else if (this.status !== 200) reject("Error getting TTS response from Watson. Status: " + this.status);
                };
                xhr.send();
            });
        };

        /**
         * Stitches timestamps together into a single audio file.
         * NOTE: Forgiving. If talken has no audio file, this function skips it.
         * Please use isStitchable to check whether an audio file is missing.
         * @param  {[Talken]} talkens - An array of Talkens
         * @return {Promise}          - A Promise passing the audio URL.
         */
        pub.stitch = (talkens) => {
            var snippets = talkens.map((t) => ({'url':t.audio.url, 't_bgn':t.bgn, 't_end':t.end}));
            return new Promise(function(resolve, reject) {
                r2.audioStitcher.run(snippets, function(rsc) {
                    var url = rsc[0]; var blob = rsc[1];
                    if (!url) reject("r2.audiosynth.stitch: URL is null.");
                    else resolve({'url':url, 'blob':blob});
                });
            });
        };
        var stitch = pub.stitch;

        /**
         * Checks whether all talkens in array have audio attached.
         */
        pub.isStitchable = (talkens) => {
            for (var t of talkens)
                if (typeof t.audio === "undefined") return false;
            return true;
        };

        /**
         * Downloads TTS audio for array of talkens (transcript + natural audio).
         * @param  {[Talken]} talkens - An array of talkens
         * @return {Promise}          - Returns the TTS audio (in a Promise).
         */
        pub.synthesize = (talkens, config) => {
            if (typeof config === "undefined") // default config
                config = { mode:'TTS', transfer:'prosody,duration' };

            // Convert the array of talkens to SSML transcript (a transcript string with some XML, maybe)
            var ssml = toSSML(talkens);

            // Download text-to-speech audio from reputable synthesizer
            // (1) If no post-processing is needed, just return Watson's response.
            if (!config.transfer || typeof config.transfer === "undefined" || config.transfer.length === 0) {
                console.warn('Only returning raw TTS with config', config.transfer);
                return getTTSAudioFromWatson(ssml).then(function(rsc) {
                    var aud = { 'url':rsc[0], 'blob':rsc[1] };
                    return new Promise(function(resolve, reject) {
                        resolve(aud);
                    });
                });
            }

            // (2) Perform post-processing.
            var src_ts = toTimestamps(talkens);
            var transcript = toTranscript(talkens);
            var srcwav, twav;
            return stitch(talkens).then(function(rsc) {
                srcwav = rsc.url;
                return getTTSAudioFromWatson(ssml);
            }).then(function(rsc) {
                twav = rsc[0]; // url
                return Praat.calcTimestamps(twav, transcript);
            }).then(function(target_ts) {          // Calculate timestamps for TTS using forced alignment.
                console.log('synthesize: Performed forced alignment. Checking data...');
                if (!target_ts) throw 'No timestamps returned.';
                else if (target_ts.length !== src_timestamps.length) throw 'Timestamp data mismatch: ' + src_timestamps.length + ' != ' + target_ts.length;
                console.log('synthesize: Data checked. Transferring prosody...');
                return Praat.transfer(srcwav, twav, src_ts, target_ts, config.transfer);   // Transfer properties from speech to TTS waveform.
            }).then(function(resynth_blob) { // Transfer blob data to URL
                var url = (window.URL || window.webkitURL).createObjectURL(resynth_blob);
                return new Promise(function(resolve, reject) {
                    resolve({ 'url':url, 'blob':resynth_blob });
                });
            }).catch(function(err) {
                console.log('Error @ synthesize: ', err);
            });
        };

        /**
         * :: TO BE IMPLEMENTED ::
         * TODO:
         * Downloads or patches audio for talkens missing audio.
         * Called in preparation for stitching _natural audio_.
         * @param  {[Talken]} talkens - An array of talkens
         * @return {Promise}          - Returns when the last audio is patched.
         */
        pub.patch = (talkens) => {

            var mode = 'TTS'; // TODO: Make this mode a module-wide global

            talkens.forEach(function(t) {
                if (typeof t.audio === "undefined") {

                    // .. TODO: Patch audio by looking for previous utterances in a database.

                }
            });

            return new Promise(function(resolve, reject) {
                resolve(); // .. TODO: Change to wait for conmpletion of patch.
            });
        };

        return pub;

    }());

}(window.r2 = window.r2 || {}));
