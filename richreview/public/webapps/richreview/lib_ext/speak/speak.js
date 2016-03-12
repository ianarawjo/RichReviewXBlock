"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
(function (r2) {
    "use strict";

    /**
     * @module r2.speak
     */

    r2.speak = function () {
        var _this2 = this;

        var pub_speak = {};

        /**
         * An instance of Newspeak's text-to-audio controller.
         */
        pub_speak.controller = function () {
            var pub = {};

            var base = [];
            var ops = [];
            var edited = [];
            var _needsupdate = false;
            var _needsrender = true;
            var _stitching = false;

            // Internal utils
            var utils = {
                /** Inserts a2 into a1 at index.
                 *  See http://stackoverflow.com/a/7032717. */
                injectArray: function injectArray(a1, a2, index) {
                    a1.splice.apply(a1, [index, 0].concat(a2));
                }
            };

            // Internal data structures
            var Audio = function () {
                var AudioResource = function () {
                    function AudioResource(url, blob) {
                        _classCallCheck(this, AudioResource);

                        this.url = url; // TODO: Cloud storage.
                        this.blob = blob;
                    }

                    _createClass(AudioResource, [{
                        key: "play",
                        value: function play(start_time) {
                            if (typeof start_time === "undefined") start_time = 0;
                            var url = this.url;
                            return new Promise(function (resolve, reject) {
                                r2.audioPlayer.play(Math.random() * 10, url, start_time * 1000.0, undefined, function () {
                                    // .. Called when stopped playing .. //
                                    resolve(true);
                                });
                            });
                        }
                    }]);

                    return AudioResource;
                }();
                var resources = [];
                return {
                    for: function _for(url, blob) {
                        if (url in resources) return resources[url];else {
                            var r = new AudioResource(url, blob);
                            resources[url] = r;
                            return r;
                        }
                    },
                    stitch: function stitch(talkens) {
                        // Returns stitched audio resource as a Promise.
                        return r2.audiosynth.stitch(talkens).then(function (rsc) {
                            var url = rsc.url;var blob = rsc.blob;
                            return new Promise(function (resolve, reject) {
                                if (!url) reject("Audio.stitch: Null url.");else resolve(Audio.for(url, blob));
                            });
                        });
                    },
                    synthesize: function synthesize(talkens, options) {
                        return r2.audiosynth.synthesize(talkens, { mode: 'TTS', transfer: options }).then(function (rsc) {
                            var url = rsc.url;var blob = rsc.blob;
                            return new Promise(function (resolve, reject) {
                                if (!url) reject("Audio.synthesize: Null url.");else resolve(Audio.for(url, blob));
                            });
                        });
                    }
                };
            }();
            var EditType = {
                UNCHANGED: 0,
                INS: 1, // insertion
                DEL: 2, // deletion
                REPL: 3, // replace
                UNKNOWN: 4
            };

            var EditOp = function () {
                function EditOp(txt, edit_type) {
                    _classCallCheck(this, EditOp);

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


                _createClass(EditOp, null, [{
                    key: "generate",
                    value: function generate(diff) {

                        // Split html by tags
                        // * Thanks Dalorzo @ SO http://stackoverflow.com/a/25462610. *
                        var htmlTagRegex = /\s*(<[^>]*>)/g;
                        var html = diff.split(htmlTagRegex);

                        // Create EditOp's
                        var es = [];
                        var et = EditType.UNKNOWN;
                        var end_tag = false;
                        var _iteratorNormalCompletion = true;
                        var _didIteratorError = false;
                        var _iteratorError = undefined;

                        try {
                            for (var _iterator = html[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                var s = _step.value;

                                if (s.length === 0) continue;else if (end_tag) {
                                    end_tag = false;
                                    continue;
                                } else if (et !== EditType.UNKNOWN) {
                                    es.push(new EditOp(s, et));
                                    et = EditType.UNKNOWN;
                                    end_tag = true;
                                } else if (s === '<del>') et = EditType.DEL;else if (s === '<ins>') et = EditType.INS;else {
                                    var words = s.trim().split(/\s+/);
                                    words.forEach(function (wrd) {
                                        es.push(new EditOp(wrd, EditType.UNCHANGED));
                                    });
                                }
                            }
                        } catch (err) {
                            _didIteratorError = true;
                            _iteratorError = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion && _iterator.return) {
                                    _iterator.return();
                                }
                            } finally {
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                        }

                        console.log('raw editops: ', es);

                        // Second-pass: Collapse multiple back-to-back DEL-INS (e.g. DEL DEL DEL INS INS INS)
                        // to a series of REPL:
                        var i;
                        var dels = [];
                        for (i = 0; i < es.length; i++) {
                            if (es[i].type === EditType.DEL) {
                                dels.push(i);
                            } else if (dels.length > 0 && es[i].type === EditType.INS) {
                                es.splice(dels[0], 1, new EditOp(es[i].text, EditType.REPL)); // replace DEL op w/ REPL op
                                es.splice(i, 1); // remove INS op
                                dels.splice(0, 1); // delete recorded DEL index (as this op is now REPL)
                                i--;
                            } else dels = [];
                        }

                        console.log('mod editops: ', es);

                        // Second-pass: Replacing DEL-INS back-to-backs with REPLACE.
                        // * Makes our jobs a bit easier later. *
                        /*var e;
                        for (i = 0; i < es.length-1; i++) {
                            if (es[i].type === EditType.DEL && es[i+1].type === EditType.INS) {
                                es.splice(i, 2, new EditOp(es[i+1].text, EditType.REPL));
                                i--;
                            }
                        }*/

                        return es;
                    }
                }]);

                return EditOp;
            }();

            var Talken = function () {
                function Talken(wrd, bgn, end, audioRsc) {
                    _classCallCheck(this, Talken);

                    this.word = wrd;
                    this.bgn = bgn;
                    this.end = end;
                    this.audio = audioRsc;
                }

                _createClass(Talken, [{
                    key: "replaceWord",
                    value: function replaceWord(txt) {
                        this.word = txt;
                    }
                }, {
                    key: "setPauseAfter",
                    value: function setPauseAfter(ms) {
                        this._pauseAfter = ms;
                    }
                }, {
                    key: "setPauseBefore",
                    value: function setPauseBefore(ms) {
                        this._pauseBefore = ms;
                    }
                }, {
                    key: "clone",
                    value: function clone() {
                        var t = new Talken(this.word, this.bgn, this.end, this.audio);
                        if (this.pauseBefore > 0) t.setPauseBefore(this.pauseBefore);
                        if (this.pauseAfter > 0) t.setPauseAfter(this.pauseAfter);
                        return t;
                    }
                }, {
                    key: "pauseBefore",
                    get: function get() {
                        return this._pauseBefore || 0;
                    }
                }, {
                    key: "pauseAfter",
                    get: function get() {
                        return this._pauseAfter || 0;
                    }
                }], [{
                    key: "generate",
                    value: function generate(timestamps, audioURL) {
                        var talkens = [];
                        var audio = Audio.for(audioURL);
                        var prev_t = null;
                        var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.
                        var _iteratorNormalCompletion2 = true;
                        var _didIteratorError2 = false;
                        var _iteratorError2 = undefined;

                        try {
                            for (var _iterator2 = timestamps[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                var t = _step2.value;


                                // Create new talken for timestamp
                                talkens.push(new Talken(t[0], t[1], t[2], audio));

                                // Detect + store pauses in original timestamp data.
                                if (prev_t) {
                                    if (t[1] === 0 && t[2] === 0 || prev_t[1] === 0 && prev_t[2] === 0) {} else {
                                        var pause_len_ms = Math.round((t[1] - prev_t[2]) * 1000.0); // current bgn - previous end
                                        if (pause_len_ms > PAUSE_THRESHOLD_MS) {
                                            // if pause length is significant...
                                            talkens[talkens.length - 1].setPauseBefore(pause_len_ms); // set pause before current talken
                                            talkens[talkens.length - 2].setPauseAfter(pause_len_ms); // set pause after prev talken
                                        }
                                    }
                                }
                                prev_t = t;
                            }
                        } catch (err) {
                            _didIteratorError2 = true;
                            _iteratorError2 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                                    _iterator2.return();
                                }
                            } finally {
                                if (_didIteratorError2) {
                                    throw _iteratorError2;
                                }
                            }
                        }

                        return talkens;
                    }
                }, {
                    key: "generateFromHTK",
                    value: function generateFromHTK(audioURL, perfect_transcript) {
                        return Praat.calcTimestamps(audioURL, perfect_transcript).then(function (ts) {
                            return new Promise(function (resolve, reject) {
                                resolve(Talken.generate(ts, audioURL));
                            });
                        });
                    }
                }, {
                    key: "clone",
                    value: function clone(t) {
                        if (t instanceof Talken) return t.clone();else if (t instanceof Array) return t.map(function (tn) {
                            return tn.clone();
                        });else {
                            console.log("Error @ Talken.clone: Object is not instance of Talken or Array!", t);
                            return null;
                        }
                    }
                }]);

                return Talken;
            }();

            /**
             * Compiles the transcript for the given talkens.
             * @return {string} The compiled transcript.
             */


            var transcript = function transcript(talkens) {
                return talkens.map(function (talken) {
                    return talken.word;
                }).join(' ');
            };
            var base_transcript = function base_transcript() {
                return transcript(base);
            };

            /**
             * Inserts timestamp data at index. This is
             * not counted as an 'edit' operation.
             * @param  {int} index            The insertion position in the base transcript, as a word index. (e.g. 1 for 'hello Watson' => 'hello IBM Watson')
             * @param  {[timestamp]} ts       The timestamp data with transcript information.
             * @param  {string} audioURL      The audio that the timestamps refer to.
             * @return {bool}                 Success or failure.
             */
            pub.insertVoice = function (index, ts, audioURL) {

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

                _needsupdate = true;
                return true;
            };

            /* Command stack operations */
            var clipboard = null;
            var Stack = function Stack() {
                var _this = this;

                var stack = [];
                return {
                    record: function record() {
                        return _this.push(base);
                    },
                    push: function push(ts) {
                        return stack.push(ts);
                    },
                    pop: function pop() {
                        return stack.pop();
                    },
                    clear: function clear() {
                        return stack = [];
                    }
                };
            };
            var undostack = new Stack();
            var redostack = new Stack();
            pub.undo = function () {
                if (undostack.length === 0) return;
                redostack.record();
                var prev_ts = undostack.pop();
                base = prev_ts;
                _needsupdate = true;
            };
            pub.redo = function () {
                if (redostack.length === 0) return;
                undostack.record();
                var next_ts = redostack.pop();
                base = next_ts;
                _needsupdate = true;
            };
            pub.remove = function (start_idx, len) {
                undostack.record();
                redostack.clear();
                if (start_idx < 0 || start_idx + len > base.length) {
                    console.warn("r2.speak.remove: Incorrect range.");
                    return false;
                }
                base.splice(start_idx, len);
                _needsupdate = true;
                return true;
            };
            pub.cut = function (start_idx, len) {
                undostack.record();
                redostack.clear();
                if (start_idx < 0 || start_idx + len > base.length) {
                    console.warn("r2.speak.cut: Incorrect range.");
                    return false;
                }
                clipboard = Talken.clone(base.slice(start_idx, start_idx + len)); // deep copy of subarray
                return _this2.remove(start_idx, len);
            };
            pub.paste = function (start_idx) {
                undostack.record();
                redostack.clear();
                if (start_idx > base.length) {
                    console.log("r2.speak.paste: caution: start index past length of array.", start_idx);
                    start_idx = base.length;
                }
                if (!clipboard) {
                    console.warn("r2.speak.paste: Nothing in clipboard.");
                    return false;
                }
                base.splice(start_idx, 0, Talken.clone(clipboard));
                _needsupdate = true;
                return true;
            };

            /**
             * Update transcript model with edits made by user.
             * TODO: Move edit graph update elsewhere.
             * @param  {string} transcript The new transcript || an edit graph on the base transcript.
             */
            var _last_transcript = '';
            pub.update = function (new_transcript) {
                if (new_transcript === _last_transcript) return;

                var bt = base_transcript();
                bt = bt.replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g, "");
                bt = bt.toLowerCase();

                // remove punctuation
                var stripped_transcript = new_transcript.replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g, "");

                // lowercase
                stripped_transcript = stripped_transcript.toLowerCase();

                // Calculate diff between base and new transcript
                // *** REQUIRES jsdiff.js ***
                console.log('Computing diff with base "' + bt + '" and new "' + stripped_transcript + '"');

                var diffParts = JsDiff.diffWords(bt, stripped_transcript);
                var diff = '';
                diffParts.forEach(function (part) {
                    part.value.split(/\s+/).forEach(function (wrd) {
                        if (wrd.replace(/\s+/, '').length === 0) return;
                        if (part.removed) diff += "<del>" + wrd.trim() + "</del> ";else if (part.added) diff += "<ins>" + wrd.trim() + "</ins> ";else diff += wrd.trim() + " ";
                    });
                });

                //var diff = diffString(bt, stripped_transcript);
                if (diff === bt) return; // Nothing changed.
                console.log("Compiled diff: ", diff);

                // Generate array of EditOp's
                var edits = EditOp.generate(diff);

                // Store
                ops = edits;

                // Compile edits
                edited = _compile(base, ops);
                console.log('edited: ', edited);

                // Repair punctuation + capitalization
                var wrds = new_transcript.trim().split(/\s+/);
                if (wrds.length !== edited.length) console.warn('Warning @ r2.speak.update: # of talkens doesn\'t match # of words.', wrds);
                for (var i = 0; i < wrds.length; i++) {
                    if (wrds[i].length === 0) continue;
                    edited[i].replaceWord(wrds[i]);
                }

                _last_transcript = new_transcript;
                _needsupdate = false;
                _needsrender = true;
            };
            pub.getCompiledTalkens = function () {
                return edited;
            };
            pub.needsRender = function () {
                return _needsrender;
            };

            pub.updateSimpleSpeech = function (ctrl_talkens) {

                // Convert simple speech talkens into Array of Talken objects
                console.log('');
                edited = ctrl_talkens.map(function ($span) {
                    console.log($span[0].word, $span[0].bgn, $span[0].end, $span[0].audioURL);
                    return new Talken($span[0].word, $span[0].bgn, $span[0].end, Audio.for($span[0].audioURL));
                });
                console.log('');

                _needsupdate = false;
                _needsrender = true;
            };

            /*
                Takes talkens and a sequence EditOp operations on those
                talkens, and returns a new talken array with edit operations applied.
                NOTE: If you pass nothing, it'll compile on r2.speak variables base and ops.
                NOTE: If you just pass talkens, it'll try to use stored edit operations from update().
             */
            var _compile = function _compile(talkens, edits) {

                console.log("Compiling talkens, edits: ", talkens, edits);

                var ts = Talken.clone(talkens);

                // Trivial cases
                if (ts.length === 0 || edits.length === 0) return ts;

                var checkmatch = function checkmatch(e, t) {
                    // logging function
                    if (e.text !== t.word) {
                        console.log("Error @ ETC.update: Deleted word '" + e.text + "' doesn't match word '" + t.word + "' in prev transcript.");
                        return false;
                    }
                    return true;
                };

                // Loop through edits, performing one at a time
                var j = 0;
                for (var i = 0; i < edits.length; i++) {
                    var e = edits[i];

                    console.log(" :: For edit ", e);

                    if (e.type === EditType.REPL) {

                        console.log(" :: -> replacing word ", ts[j].word, 'with', e.text);
                        ts[j].replaceWord(e.text);

                        j++;
                    } else if (e.type === EditType.DEL) {
                        checkmatch(e, ts[j]); // the word of the deleted talken should match the word deleted in the edit

                        console.log(" :: -> removing talken ", ts[j]);

                        // At index j remove 1 talken.
                        ts.splice(j, 1);

                        //j--;
                    } else if (e.type === EditType.INS) {

                            // At index j insert a new talken.
                            // NOTE: We don't know what the audio is yet, so we pass null.
                            // This should flag the synthesis func that we need audio
                            // for this talken before stitching can take place.
                            console.log(" :: -> inserting talken at", j, "w/ word", e.text);
                            ts.splice(j, 0, new Talken(e.text, 0, 0, null));

                            j++; // skip over the inserted talken
                        } else {
                                checkmatch(e, ts[j]); // nothing better have changed!
                                j++;
                            }
                }

                return ts;
            };

            /** Audio Operations */
            /**
             * Render the audio.
             * @param  {int} idx           - The index of the talken to begin playing at. Defaults to 0.
             * @return {Promise | null}    - On success, returns Promise containing URL to audio resource.
             */
            pub.renderAudio = function () {
                return _render('natural');
            };
            pub.renderAudioAnon = function () {
                var options = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

                return _render('anon', options);
            };
            var _render = function _render(mode, options) {
                if (_stitching) {
                    console.warn("Error @ r2.speak.render: Audio is currently being stitched from a previous play() call. Please wait.");
                    return null;
                } else if (_needsupdate) {
                    console.error("Error @ r2.speak.render: Unsure whether internal model of talkens matches visual. Please call update method before rendering.");
                    return null;
                } else if (!edited || edited.length === 0) {
                    console.warn("Error @ r2.speak.render: No compiled talkens found. Call compile() before play(), or insert a transcript.");
                    return null;
                } else if (mode !== 'natural' && mode !== 'anon' && mode !== 'anon+htk') {
                    console.warn("Error @ r2.speak.render: Unrecognized mode.");
                    return null;
                }

                // Create clean copy of edited talkens, just in case.
                var talkens = Talken.clone(edited);

                // Since this is async call, we need to be
                // careful about calling 'play' again.
                _stitching = true;

                // Compile the audio
                var after_stitching = function after_stitching(stitched_resource) {

                    console.log("stitched talkens: ", stitched_resource);

                    // Repair talken urls to point to stitched resource:
                    var _bgn = 0; // running time
                    talkens.forEach(function (t) {
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
                    _needsrender = false;

                    return new Promise(function (resolve, reject) {
                        resolve(stitched_resource);
                    });
                };

                if (mode === 'natural') {
                    return Audio.stitch(talkens).then(after_stitching).catch(function (err) {
                        console.warn("Error @ r2.speak.render: Audio stitch failed.", err);
                        _stitching = false;
                    });
                } else if (mode === 'anon') {
                    return Audio.synthesize(talkens, options).then(after_stitching).catch(function (err) {
                        console.warn("Error @ r2.speak.render: Audio synthesize failed.", err);
                        _stitching = false;
                    });
                } else if (mode === 'anon+htk') {
                    return Audio.stitch(base).then(function (stitched_base) {
                        console.log('..stitched base talkens. Generating new talkens from HTK...');
                        var transcript = r2.audiosynth.toTranscript(talkens).replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g, ""); // strip any punctuation (just in case)
                        return Talken.generateFromHTK(stitched_base.url, transcript);
                    }).then(function (perfect_talkens) {
                        console.log('..HTK returned: ', perfect_talkens);

                        // repair words
                        for (var i = 0; i < perfect_talkens.length; i++) {
                            var pt = perfect_talkens[i];
                            pt.replaceWord(talkens[i].word);
                        }

                        console.log('..synthesizing..');
                        return Audio.synthesize(perfect_talkens, options).then(after_stitching).catch(function (err) {
                            console.warn("Error @ r2.speak.render: Audio synthesize failed.", err);
                            _stitching = false;
                        });
                    }).catch(function (err) {
                        console.warn("Error @ r2.speak.generateFromHTK: ", err);
                        _stitching = false;
                    });
                }
            };
            return pub;
        };

        return pub_speak;
    }();

    /**
     * @module r2.audiosynth
     * Operations on talken arrays.
     */
    r2.audiosynth = function () {

        var pub = {};

        /** Helper function to convert talkens to timestamps in format [word, bgn, end].
         *  This will *not* skip over audioless talkens. Instead, it will save them with bgn, end as 0. */
        var toTimestamps = function toTimestamps(talkens) {
            var ts = [];
            talkens.forEach(function (t) {
                if (typeof t.audio === "undefined" || !t.audio || !t.audio.url) ts.push([t.word, 0, 0]);else ts.push([t.word, t.bgn, t.end]);
            });
            return ts;
        };
        pub.toTimestamps = toTimestamps;

        /** Helper function to convert talkens to string transcript.
         *  This will *not* skip over audioless talkens. */
        var toTranscript = function toTranscript(talkens) {
            var ts = '';
            talkens.forEach(function (t) {
                ts += t.word + ' ';
            });
            return ts.trim();
        };
        pub.toTranscript = toTranscript;

        /**
         * Generate transcript with SSML given transcript from text box (as edited array of talkens).
         * @param  {[Talken]} talkens - An array of (edited) talkens
         * @return {string}           - SSML transcript, to be sent to a speech synthesizer like IBM Watsom.
         */
        var toSSML = function toSSML(talkens) {
            var words = toTranscript(talkens).split(' ');
            var breaks = [];
            var wpms = {};

            if (words.length !== talkens.length) {
                console.log('Error: toSSML: Timestamp mismatch.', words.length, talkens.length, talkens);
                return "";
            }

            // Calculate breaks
            //var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.
            var PAUSE_MAX_MS = 1000; // cap pauses at a full second
            for (var i = 1; i < words.length; i++) {
                var word = words[i].replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g, ""); // strip any punctuation (just in case)
                var ts = talkens[i];
                var prev_ts = talkens[i - 1];

                if (ts.bgn === 0 && ts.end === 0 || prev_ts.bgn === 0 && prev_ts.end === 0) {
                    console.warn('toSSML: Skipping null talken.');
                    breaks.push(0);
                    continue;
                }

                if (ts.pauseBefore > 0) breaks.push(Math.min(ts.pauseBefore, PAUSE_MAX_MS));else if (prev_ts.pauseAfter > 0) breaks.push(Math.min(prev_ts.pauseAfter, PAUSE_MAX_MS));else breaks.push(0);

                /*var pause_len_ms = Math.round((ts.bgn - prev_ts.end) * 1000.0); // current bgn - previous end
                if (pause_len_ms > PAUSE_THRESHOLD_MS) {
                    breaks.push(Math.min(pause_len_ms, PAUSE_MAX_MS));
                 } else {
                    breaks.push(0);
                }*/
            }

            // Reconstruct text w/ SSML.
            var ssml = '';
            for (i = 0; i < words.length; i++) {
                var wrd = words[i];
                if (breaks[i] > 0 && i < words.length - 1) {
                    ssml += wrd;
                    ssml += '<break time="' + breaks[i].toString() + 'ms"></break> ';
                } else ssml += wrd + ' ';
            }

            return ssml;
        };

        /**
         * Get synthesized audio from IBM Watson.
         * @param  {string} ssml - Transcript as SSML
         * @return {Promise}     - Returns url to the TTS audio blob.
         */
        var getTTSAudioFromWatson = function getTTSAudioFromWatson(ssml, voice) {
            var asStreamingOgg = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

            if (typeof voice === "undefined") voice = "en-US_MichaelVoice";

            var $dummy_ta = $('<textarea>');
            $dummy_ta.val(ssml);

            // TODO:
            // 0. Remove need for jQuery serialization call
            // 1. Abstract away from hardcoding the base app URL.
            // 2. Change from GET to POST request.
            // 3. Make voice (e.g. Michael) customizable!
            // 4. MAYBE: Split ssml into multiple chunks if it's long...
            var tts_audiourl = 'https://newspeak-tts.mybluemix.net/synthesize?text' + $.param($dummy_ta) + '&voice=' + voice;
            console.log("Getting TTS from url ", tts_audiourl);

            if (asStreamingOgg === true) {
                return new Promise(function (resolve, reject) {
                    resolve([tts_audiourl, null]);
                });
            } else {
                tts_audiourl += '&accept=audio/wav';

                // Request Watson TTS server
                return new Promise(function (resolve, reject) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', tts_audiourl, true);
                    xhr.responseType = 'blob';
                    xhr.onreadystatechange = function (e) {
                        if (this.readyState == 4 && this.status == 200) {
                            var blob = this.response;
                            resolve([URL.createObjectURL(blob), blob]);
                        } else if (this.status !== 200) reject("Error getting TTS response from Watson. Status: " + this.status);
                    };
                    xhr.send();
                });
            }
        };

        /**
         * Stitches timestamps together into a single audio file.
         * NOTE: Forgiving. If talken has no audio file, this function skips it.
         * Please use isStitchable to check whether an audio file is missing.
         * @param  {[Talken]} talkens - An array of Talkens
         * @return {Promise}          - A Promise passing the audio URL.
         */
        pub.stitch = function (talkens) {
            var snippets = [];
            talkens.forEach(function (t) {
                snippets.push({ 'url': t.audio.url, 't_bgn': t.bgn, 't_end': t.end });
                if (t.pauseAfter > 0) snippets.push({ 'url': 'static_audio/pauseResource.wav', 't_bgn': 0, 't_end': Math.max(t.pauseAfter / 1000.0, 1.0) });
            });

            return new Promise(function (resolve, reject) {
                r2.audioStitcher.run(snippets, function (rsc) {
                    var url = rsc[0];var blob = rsc[1];
                    if (!url) reject("r2.audiosynth.stitch: URL is null.");else resolve({ 'url': url, 'blob': blob });
                });
            });
        };
        var stitch = pub.stitch;

        /**
         * Checks whether all talkens in array have audio attached.
         */
        pub.isStitchable = function (talkens) {
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
                for (var _iterator3 = talkens[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var t = _step3.value;

                    if (typeof t.audio === "undefined") return false;
                }
            } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                    }
                } finally {
                    if (_didIteratorError3) {
                        throw _iteratorError3;
                    }
                }
            }

            return true;
        };

        /**
         * Downloads TTS audio for array of talkens (transcript + natural audio).
         * @param  {[Talken]} talkens - An array of talkens
         * @return {Promise}          - Returns the TTS audio (in a Promise).
         */
        pub.synthesize = function (talkens, config) {
            if (typeof config === "undefined") // default config
                config = { mode: 'TTS', transfer: 'prosody,duration' };

            // Convert the array of talkens to SSML transcript (a transcript string with some XML, maybe)
            var ssml = toSSML(talkens);

            // Download text-to-speech audio from reputable synthesizer
            // (1) If no post-processing is needed, just return Watson's response.
            if (!config.transfer || typeof config.transfer === "undefined" || config.transfer.length === 0) {
                console.warn('Only returning raw TTS with config', config.transfer);
                return getTTSAudioFromWatson(ssml, 'en-US_MichaelVoice', true).then(function (rsc) {
                    var aud = { 'url': rsc[0], 'blob': null };
                    return new Promise(function (resolve, reject) {
                        resolve(aud);
                    });
                });
            }

            // (2) Perform post-processing.
            var src_ts = toTimestamps(talkens);
            var transcript = toTranscript(talkens);
            var srcwav, twav;
            return stitch(talkens).then(function (rsc) {
                srcwav = rsc.url;
                return getTTSAudioFromWatson(ssml);
            }).then(function (rsc) {
                twav = rsc[0]; // url
                return Praat.calcTimestamps(twav, transcript);
            }).then(function (target_ts) {
                // Calculate timestamps for TTS using forced alignment.
                console.log('synthesize: Performed forced alignment. Checking data...');
                if (!target_ts) throw 'No timestamps returned.';else if (target_ts.length !== src_ts.length) throw 'Timestamp data mismatch: ' + src_ts.length + ' != ' + target_ts.length;
                console.log('synthesize: Data checked. Transferring prosody...');
                return Praat.transfer(srcwav, twav, src_ts, target_ts, config.transfer); // Transfer properties from speech to TTS waveform.
            }).then(function (resynth_blob) {
                // Transfer blob data to URL
                var url = (window.URL || window.webkitURL).createObjectURL(resynth_blob);
                return new Promise(function (resolve, reject) {
                    resolve({ 'url': url, 'blob': resynth_blob });
                });
            }).catch(function (err) {
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
        pub.patch = function (talkens) {

            var mode = 'TTS'; // TODO: Make this mode a module-wide global

            talkens.forEach(function (t) {
                if (typeof t.audio === "undefined") {

                    // .. TODO: Patch audio by looking for previous utterances in a database.

                }
            });

            return new Promise(function (resolve, reject) {
                resolve(); // .. TODO: Change to wait for conmpletion of patch.
            });
        };

        return pub;
    }();
})(window.r2 = window.r2 || {});
