'use strict';

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

        var pub_speak = {};

        pub_speak.removePauseMarkers = function (txt) {
            return txt.replace(/♦/g, '');
        };
        pub_speak.removeStrayPunctuation = function (txt) {
            // replace all isolated punctuation marks; replace all punctuation attached to a pause marker with the marker (' ♦,' => ' ♦')
            return txt.replace(/\s[.,-\/#!?$%\^&\*;:{}=\-_`~'()]\s/g, ' ').replace(/\s♦[.,-\/#!?$%\^&\*;:{}=\-_`~'()]/g, ' ♦');
        };

        // Really special thanks to Tim @ SO:
        // http://stackoverflow.com/a/13950376
        var saveSelection, restoreSelection;
        if (window.getSelection && document.createRange) {
            saveSelection = function saveSelection(containerEl) {
                var sel = window.getSelection();
                if (sel.rangeCount === 0) return { start: 0, end: 0 };
                var range = sel.getRangeAt(0);
                var preSelectionRange = range.cloneRange();
                preSelectionRange.selectNodeContents(containerEl);
                preSelectionRange.setEnd(range.startContainer, range.startOffset);
                var start = preSelectionRange.toString().length;

                return {
                    start: start,
                    end: start + range.toString().length
                };
            };

            restoreSelection = function restoreSelection(containerEl, savedSel) {
                var charIndex = 0,
                    range = document.createRange();
                range.setStart(containerEl, 0);
                range.collapse(true);
                var nodeStack = [containerEl],
                    node,
                    foundStart = false,
                    stop = false;

                while (!stop && (node = nodeStack.pop())) {
                    if (node.nodeType == 3) {
                        var nextCharIndex = charIndex + node.length;
                        if (!foundStart && savedSel.start >= charIndex && savedSel.start <= nextCharIndex) {
                            range.setStart(node, savedSel.start - charIndex);
                            foundStart = true;
                        }
                        if (foundStart && savedSel.end >= charIndex && savedSel.end <= nextCharIndex) {
                            range.setEnd(node, savedSel.end - charIndex);
                            stop = true;
                        }
                        charIndex = nextCharIndex;
                    } else {
                        var i = node.childNodes.length;
                        while (i--) {
                            nodeStack.push(node.childNodes[i]);
                        }
                    }
                }

                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            };
        } else if (document.selection && document.body.createTextRange) {
            saveSelection = function saveSelection(containerEl) {
                var selectedTextRange = document.selection.createRange();
                var preSelectionTextRange = document.body.createTextRange();
                preSelectionTextRange.moveToElementText(containerEl);
                preSelectionTextRange.setEndPoint("EndToStart", selectedTextRange);
                var start = preSelectionTextRange.text.length;

                return {
                    start: start,
                    end: start + selectedTextRange.text.length
                };
            };

            restoreSelection = function restoreSelection(containerEl, savedSel) {
                var textRange = document.body.createTextRange();
                textRange.moveToElementText(containerEl);
                textRange.collapse(true);
                textRange.moveEnd("character", savedSel.end);
                textRange.moveStart("character", savedSel.start);
                textRange.select();
            };
        }
        pub_speak.saveSelection = saveSelection;
        pub_speak.restoreSelection = restoreSelection;

        var _current_annot_id = null;
        pub_speak.GetCurrentAnnotId = function () {
            return _current_annot_id;
        };
        pub_speak.SetCurrentAnnotId = function (aid) {
            _current_annot_id = aid;
        };

        var Talken = function () {
            function Talken(wrd, bgn, end, audioRsc) {
                _classCallCheck(this, Talken);

                this.word = wrd;
                this.bgn = bgn;
                this.end = end;
                this.audio = audioRsc;
            }

            _createClass(Talken, [{
                key: 'replaceWord',
                value: function replaceWord(txt) {
                    this.word = txt;
                }
            }, {
                key: 'setPauseAfter',
                value: function setPauseAfter(ms) {
                    this._pauseAfter = ms;
                }
            }, {
                key: 'setPauseBefore',
                value: function setPauseBefore(ms) {
                    this._pauseBefore = ms;
                }
            }, {
                key: 'clone',
                value: function clone() {
                    var t = new Talken(this.word, this.bgn, this.end, this.audio);
                    if (this.pauseBefore > 0) t.setPauseBefore(this.pauseBefore);
                    if (this.pauseAfter > 0) t.setPauseAfter(this.pauseAfter);
                    return t;
                }
            }, {
                key: 'pauseBefore',
                get: function get() {
                    return this._pauseBefore || 0;
                }
            }, {
                key: 'pauseAfter',
                get: function get() {
                    return this._pauseAfter || 0;
                }
            }], [{
                key: 'generate',
                value: function generate(timestamps, audioURL) {
                    var talkens = [];
                    var audio = Audio.for(audioURL);
                    var prev_t = null;
                    var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.
                    var _iteratorNormalCompletion = true;
                    var _didIteratorError = false;
                    var _iteratorError = undefined;

                    try {
                        for (var _iterator = timestamps[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                            var t = _step.value;


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

                    return talkens;
                }
            }, {
                key: 'generateFromHTK',
                value: function generateFromHTK(audioURL, perfect_transcript) {
                    return Praat.calcTimestamps(audioURL, perfect_transcript).then(function (ts) {
                        return new Promise(function (resolve, reject) {
                            resolve(Talken.generate(ts, audioURL));
                        });
                    });
                }
            }, {
                key: 'clone',
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

        pub_speak.Talken = Talken;

        // Internal data structures
        var Audio = function () {
            var AudioResource = function () {
                function AudioResource(annotId) {
                    _classCallCheck(this, AudioResource);

                    this.annotId = annotId; // TODO: Cloud storage.
                }

                _createClass(AudioResource, [{
                    key: 'url',
                    get: function get() {
                        if (this.annotId.indexOf('blob:') > -1) return this.annotId; // backwards compatability
                        else return r2App.annots[this.annotId].GetAudioFileUrl();
                    }
                }]);

                return AudioResource;
            }();
            var resources = [];
            return {
                for: function _for(url) {
                    if (url in resources) return resources[url];else {
                        var r = new AudioResource(url);
                        resources[url] = r;
                        return r;
                    }
                },
                stitch: function stitch(talkens) {
                    // Returns stitched audio resource as a Promise.
                    return r2.audiosynth.stitch(talkens).then(function (sobj) {
                        return new Promise(function (resolve, reject) {
                            if (!sobj.url) reject("Audio.stitch: Null url.");else resolve(sobj.url);
                        });
                    });
                },
                synthesize: function synthesize(talkens, options) {
                    return r2.audiosynth.synthesize(talkens, { mode: 'TTS', transfer: options }).then(function (url) {
                        return new Promise(function (resolve, reject) {
                            if (!url) reject("Audio.synthesize: Null url.");else resolve(url);
                        });
                    });
                },
                patchSynthesize: function patchSynthesize(talkens, prevTalkens, prevTTSTalkens) {
                    return r2.audiosynth.patchSynthesize(talkens, prevTalkens, prevTTSTalkens);
                },
                patch: function patch(talkens) {
                    return r2.audiosynth.patch(talkens).then(function (sobj) {
                        return new Promise(function (resolve, reject) {
                            if (!sobj.url) reject("Audio.patch: Null url.");else resolve(sobj.url);
                        });
                    });
                },
                getTTSAudioURL: function getTTSAudioURL(talkens, voice) {
                    return r2.audiosynth.getTTSAudioURL(r2.audiosynth.toSSML(talkens), voice);
                },
                getStreamingTTSAudioURL: function getStreamingTTSAudioURL(talkens, voice) {
                    return r2.audiosynth.getStreamingTTSAudioURL(r2.audiosynth.toSSML(talkens), voice);
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
                key: 'generate',
                value: function generate(diff) {

                    // Split html by tags
                    // * Thanks Dalorzo @ SO http://stackoverflow.com/a/25462610. *
                    var htmlTagRegex = /\s*(<[^>]*>)/g;
                    var html = diff.split(htmlTagRegex);

                    // Create EditOp's
                    var es = [];
                    var et = EditType.UNKNOWN;
                    var end_tag = false;
                    var _iteratorNormalCompletion2 = true;
                    var _didIteratorError2 = false;
                    var _iteratorError2 = undefined;

                    try {
                        for (var _iterator2 = html[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                            var s = _step2.value;

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

        /**
         * An instance of Newspeak's text-to-audio controller.
         */


        pub_speak.controller = function () {
            var pub = {};

            var base = [];
            var ops = [];
            var edited = [];
            var edited_pause_data = [];
            var _needsupdate = false;
            var _needsrender = true;
            var _stitching = false;

            // Debug
            pub.anonAudioRenderType = 'anon';
            pub.SetAnonAudioRenderType = function (new_rt) {
                pub.anonAudioRenderType = new_rt;
                _needsrender = true;
            };

            // Internal utils
            var utils = {
                /** Inserts a2 into a1 at index.
                 *  See http://stackoverflow.com/a/7032717. */
                injectArray: function injectArray(a1, a2, index) {
                    a1.splice.apply(a1, [index, 0].concat(a2));
                }
            };

            // Utility function. Generates talkens for current transcript given an audioURL.
            pub.generateTalkensFromHTK = function (audioURL) {
                if (!edited || edited.length === 0) {
                    return Promise(function (resolve, reject) {
                        reject("Warning @ r2.speak.generateTalkensFromHTK: No edited talkens found (edited is ", edited, ")");
                    });
                }
                var transcript = r2.audiosynth.toTranscript(edited).replace(/[.,-\/#!?$%\^&\*;:{}=\-_`~()]/g, ""); // strip any punctuation (just in case)
                return Talken.generateFromHTK(audioURL, transcript);
            };

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
            var _prev_bases = [];

            /**
             * Inserts timestamp data at index. This is
             * not counted as an 'edit' operation.
             * @param  {int} index            The insertion position in the base transcript, as a word index. (e.g. 1 for 'hello Watson' => 'hello IBM Watson')
             * @param  {[timestamp]} ts       The timestamp data with transcript information.
             * @param  {string} annotId       The annot id that the timestamps refer to.
             * @return {bool}                 Success or failure.
             */
            pub.insertVoice = function (index, ts, annotId) {

                if (ts.length === 0) {
                    console.log("Error @ voiceInsert: Nothing to insert.");
                    return null;
                }

                // Generate talkens for timestamps and audioURL
                var talkens = Talken.generate(ts, annotId);

                // Check that idx is valid
                if (index > base.length) {
                    console.warn("Warning @ voiceInsert: Index " + index + " extends past bounds of array.");
                    index = base.length;
                } else if (index < 0) {
                    console.log("Error @ voiceInsert: Invalid index " + index + ".");
                    return null;
                } else if (talkens.length === 0) {
                    console.log("Error @ voiceInsert: No talkens generated.");
                    return null;
                }

                // Insert talkens at index in list of stored talkens
                utils.injectArray(base, talkens, index);

                _needsupdate = true;
                return talkens;
            };
            pub.appendVoice = function (ts, annotId) {
                return pub.insertVoice(base.length, ts, annotId);
            };
            pub.flatten = function () {
                // Turn edited into base.
                if (!edited || !base) {
                    console.error('Error: No edited or base talkens to flatten.');
                    return;
                }

                // Stash previous base for posterity
                if (!_prev_bases) _prev_bases = [];
                _prev_bases.push(Talken.clone(base));

                // Set base to edited (irreversible!)
                base = Talken.clone(edited);

                console.warn('Flattened base into edited: ', _prev_bases[_prev_bases.length - 1], base);
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
                bt = bt.replace(/[.,-\/#!♦?$%\^&\*;:{}=\-_`~'()]/g, "");
                bt = bt.toLowerCase();

                // remove punctuation
                var stripped_transcript = new_transcript.replace(/[.,-\/♦#!?$%\^&\*;:{}=\-_`~'()]/g, "");

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
                //if (diff === bt) return; // Nothing changed.
                console.log("Compiled diff: ", diff);

                // Generate array of EditOp's
                var edits = EditOp.generate(diff);

                // Store
                ops = edits;

                // Experimental: Double-check consequtive sequences of edits
                // with CMU Sphinx Long Aligner.
                // ...

                // Compile edits on talken array
                edited = _compile(base, ops);
                console.log('edited: ', edited);

                // Repair punctuation, pause markers, + capitalization
                var wrds = r2.speak.removeStrayPunctuation(new_transcript.trim()).split(/\s+/);
                for (var w = 0; w < wrds.length; w++) {
                    // isolate pause markers from attachments to any words
                    if (wrds[w] === '♦') continue;
                    var space_char_i = wrds[w].indexOf('♦');
                    if (space_char_i > -1) {
                        wrds[w] = wrds[w].replace('♦', '');
                        if (space_char_i < wrds[w].length / 2) wrds.splice(w, 0, '♦');else wrds.splice(w + 1, 0, '♦');
                        w++;
                    } else if (wrds[w].trim().length === 1 && wrds[w].replace(/[.,-\/#!?$%\^&\*;:{}=\-_`~'()]/g, "").length === 0) {
                        // single-punctuation mark error
                        console.log(' ### removed isolated ' + wrds[w] + ' during repair ###');
                        wrds.splice(w, 1); // remove the isolated punctuation mark from consideration
                        w--;
                    }
                }
                console.log('wrds: ', wrds);
                edited_pause_data = [];
                for (var i = 0; i < wrds.length; i++) {
                    if (wrds[i].length === 0) continue;

                    if (wrds[i] === '♦') {
                        if (i > 0 && edited[i - 1].pauseAfter > 0) {
                            edited_pause_data.push({ 'type': EditType.UNCHANGED, 'time': edited[i - 1].pauseAfter });
                        } else if (i < edited.length) {
                            if (edited[i].pauseBefore > 0) {
                                edited_pause_data.push({ 'type': EditType.UNCHANGED, 'time': edited[i].pauseBefore });
                            } else {
                                // this token has been artifically inserted.
                                edited[i].setPauseBefore(300); // generic ms pause
                                edited_pause_data.push({ 'type': EditType.INS, 'time': 300 });
                            }
                        }
                        wrds.splice(i, 1); // remove the pause marker
                        i--; // restart the replaceWord repair for edited[i]
                        console.log('wrds: ', wrds);
                        continue;
                    } else {
                        console.log('replacing ' + edited[i] + ' with ' + wrds[i]);
                        edited[i].replaceWord(wrds[i]);
                    }

                    if (i < wrds.length - 1) {
                        if (wrds[i + 1] !== '♦') {
                            // remove pauses in talkens from deleted pause markers
                            var del_pause = false;
                            var no_punct_before = wrds[i].indexOf(/[.,-\/#!?$%\^&\*;:{}=\-_`~'()]/) === -1;
                            if (edited[i].pauseAfter > 0 && no_punct_before) {
                                edited_pause_data.push({ 'type': EditType.DEL, 'time': edited[i].pauseAfter });
                                del_pause = true;
                            }
                            edited[i].setPauseAfter(0);
                            if (i + 1 < edited.length) {
                                if (!del_pause && edited[i + 1].pauseBefore > 0 && no_punct_before) edited_pause_data.push({ 'type': EditType.DEL, 'time': edited[i + 1].pauseBefore });
                                edited[i + 1].setPauseBefore(0);
                            }
                        }
                    }
                }
                if (wrds.length !== edited.length) console.warn('Warning @ r2.speak.update: # of talkens doesn\'t match # of words.', wrds);

                _last_transcript = new_transcript;
                _needsupdate = false;
                _needsrender = true;
            };
            pub.getCompiledTalkens = function () {
                return edited;
            };
            pub.getSnapshotData = function () {

                function rm_trailing_pause(arr) {
                    if (arr && arr.length > 1 && arr[arr.length - 1].word === ' ') arr.splice(-1, 1); // Remove trailing pauses.
                }

                var bs = pub.getTalkenData(base);
                var os = pub.getOpsData(ops);
                var pause_os = pub.getPauseData(edited_pause_data);
                var es = pub.getTalkenData(edited);

                rm_trailing_pause(bs);
                rm_trailing_pause(es);

                return {
                    'base_talkens': bs,
                    'edit_ops': os,
                    'edited_talkens': es,
                    'pause_ops': pause_os
                };
            };
            pub.getPauseData = function (pauseOps) {
                var data = [];
                var types = ['unchanged', 'ins', 'del', 'repl', 'unknown'];
                pauseOps.forEach(function (op) {
                    data.push({ 'op': types[op.type], 'time': op.time });
                });
                return data;
            };
            pub.getOpsData = function (os) {
                var data = [];
                var types = ['unchanged', 'ins', 'del', 'repl', 'unknown'];
                os.forEach(function (op) {
                    data.push({ 'op': types[op.type], 'text': op.text });
                });
                return data;
            };
            pub.getTalkenData = function (tks) {
                if (typeof tks === 'undefined') tks = edited;
                var genpause = function genpause(secs, tk) {
                    return { word: ' ',
                        data: [{
                            word: ' ',
                            bgn: 0,
                            end: secs / 1000.0,
                            conf: 100,
                            annotid: tk.audio ? tk.audio.annotId : null
                        }]
                    };
                };
                var data = [];
                tks.forEach(function (tk) {

                    if (tk.pauseBefore > 0 && (data.length === 0 || data[data.length - 1].word.trim().length > 0)) data.push(genpause(tk.pauseBefore, tk));

                    data.push({ word: tk.word,
                        data: [{
                            word: tk.word,
                            bgn: tk.bgn,
                            end: tk.end,
                            conf: tk.conf, // TODO: confidence
                            annotid: tk.audio ? tk.audio.annotId : null
                        }]
                    });

                    if (tk.pauseAfter > 0) data.push(genpause(tk.pauseAfter, tk));
                });
                return data;
            };
            pub.needsRender = function () {
                return _needsrender;
            };

            pub.updateSimpleSpeech = function (ctrl_talkens) {

                // Convert simple speech talkens into Array of Talken objects
                edited = ctrl_talkens.map(function ($span) {
                    return new Talken($span[0].word, $span[0].bgn, $span[0].end, Audio.for($span[0].audioURL));
                });

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

                    // if (j < ts.length && ts[j].pauseBefore > 0 && (ops_with_pauses.length === 0 || ops_with_pauses[ops_with_pauses.length-1].text != ' '))
                    //     ops_with_pauses.push(new EditOp(' ', EditType.UNCHANGED)); // insert pause op 'before'
                    // ops_with_pauses.push(new EditOp(e.text, e.type)); // insert this op
                    // if (j < ts.length && ts[j].pauseAfter > 0)
                    //     ops_with_pauses.push(new EditOp(' ', EditType.UNCHANGED)); // insert pause op 'after'

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
                                if (j >= ts.length) continue;
                                checkmatch(e, ts[j]); // nothing better have changed!
                                j++;
                            }
                }

                return ts;
            };

            /** Audio Operations */
            /**
             * Render the audio.
             * @return {Promise | null}    - On success, returns Promise containing URL to audio resource.
             */
            pub.renderAudio = function () {
                return _render('natural');
            };

            /**
             * Renders TTS audio.
             */
            pub.renderTTSAudioPatchy = function (annotId) {
                var options = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];

                r2.speak.SetCurrentAnnotId(annotId);
                return _render('anon-patchy', options).catch(function (err) {
                    console.error(' @ renderTTSAudioPatchy: ', err);
                }.bind(pub));
            };
            pub.renderAudioAnon = function (annotId) {
                var options = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];

                r2.speak.SetCurrentAnnotId(annotId);
                r2App.annots[annotId].SetRecordingAudioFileUrl(Audio.getStreamingTTSAudioURL(edited), null);
                return _render(pub.anonAudioRenderType, options).catch(function (err) {
                    //r2App.annots[annotId].SetRecordingAudioFileUrl(Audio.getStreamingTTSAudioURL(edited), null); // Revert audio URL to streamed version.
                }.bind(pub));
            };

            var _render = function _render(mode, options) {
                if (_stitching) {
                    console.warn("Error @ r2.speak.render: Audio is currently being stitched from a previous play() call. Please wait.");
                    return new Promise(function (resolve, reject) {
                        reject("Wait your turn!");
                    });
                } else if (_needsupdate) {
                    console.error("Error @ r2.speak.render: Unsure whether internal model of talkens matches visual. Please call update method before rendering.");
                    return null;
                } else if (!edited || edited.length === 0) {
                    console.warn("Error @ r2.speak.render: No compiled talkens found. Call compile() before play(), or insert a transcript.");
                    return null;
                } else if (mode !== 'natural' && mode !== 'anon' && mode !== 'anon+htk' && mode !== 'patch' && mode !== 'anon-patchy') {
                    console.warn("Error @ r2.speak.render: Unrecognized mode.");
                    return null;
                }

                // Create clean copy of edited talkens, just in case.
                var talkens = Talken.clone(edited);

                // Since this is async call, we need to be
                // careful about calling 'play' again.
                _stitching = true;
                _needsrender = false;

                // Compile the audio
                var after_stitching = function after_stitching(stitched_url) {

                    // No longer stitching!
                    _stitching = false;

                    return new Promise(function (resolve, reject) {
                        resolve(stitched_url);
                    });
                };

                if (mode === 'natural') {
                    return Audio.stitch(talkens).then(after_stitching).catch(function (err) {
                        console.warn("Error @ r2.speak.render: Audio stitch failed.", err);
                        _stitching = false;
                    });
                } else if (mode === 'anon-patchy') {
                    var _this = pub;
                    return Audio.patchSynthesize(talkens, pub.prevEditedTalkens, pub.prevTTSTalkens).then(function (eandt) {
                        console.log('### Synthesized and received ', eandt);
                        var edited_talkens = eandt[0];
                        var tts_talkens = eandt[1];
                        console.log('reached inner ');
                        _this.prevTTSTalkens = Talken.clone(tts_talkens);
                        _this.prevEditedTalkens = Talken.clone(edited_talkens);
                        _stitching = false;
                        return new Promise(function (resolve, reject) {
                            resolve([edited_talkens, tts_talkens]);
                        });
                    });
                } else if (mode === 'anon') {
                    return Audio.synthesize(talkens, options).then(after_stitching).catch(function (err) {
                        console.warn("Error @ r2.speak.render: Audio synthesize failed.", err);
                        _stitching = false;
                    });
                } else if (mode === 'patch') {
                    return Audio.patch(talkens).then(after_stitching).catch(function (err) {
                        console.warn("Error @ r2.speak.render: Audio patch failed.", err);
                        _stitching = false;
                    });
                } else if (mode === 'anon+htk') {
                    return Audio.stitch(base).then(function (stitched_base) {
                        console.log('..stitched base talkens. Generating new talkens from HTK...');
                        var transcript = r2.audiosynth.toTranscript(talkens).replace(/[.,-\/#!?$%\^&\*;:{}=\-_`~()]/g, ""); // strip any punctuation (just in case)
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
        var STREAM_TTS = true;

        /** Helper function to convert talkens to timestamps in format [word, bgn, end].
         *  This will *not* skip over audioless talkens. Instead, it will save them with bgn, end as 0. */
        var toTimestamps = function toTimestamps(talkens) {
            var ts = [];
            talkens.forEach(function (t) {
                if (typeof t.audio === "undefined" || !t.audio || !t.audio.url) ts.push([t.word.replace(',', ''), 0, 0]);else ts.push([t.word.replace(',', ''), t.bgn, t.end]);
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
         * Attempts to repair missing timestamps by stealing time from the nearest talken w/ timestamps.
         */
        pub.smoothMissingTimestamps = function (talkens) {
            var ratio, len;
            var nextTalken = function nextTalken(idx, tks) {
                for (var i = idx; i < tks.length; i++) {
                    if (tks[i].bgn !== tks[i].end) {
                        return tks[i];
                    }
                }
                return null;
            };
            var smooth = function smooth(brokenTk, targetTk, isNext) {
                if (!targetTk) return;
                var ratio = (targetTk.word.length + 1) / (brokenTk.word.length + targetTk.word.length + 1);
                if (isNext) {
                    // target talken is after the broken one
                    brokenTk.bgn = targetTk.bgn;
                    brokenTk.end = ratio * targetTk.bgn + (1.0 - ratio) * targetTk.end; // if next_tk's word is longer, bgn has more weight, and tk's len will be shorter.
                    targetTk.bgn = brokenTk.end;
                    console.log('Smoothed next --> ', brokenTk, targetTk);
                } else {
                    // target talken is before the broken one
                    brokenTk.end = targetTk.end;
                    brokenTk.bgn = (1.0 - ratio) * targetTk.bgn + ratio * targetTk.end; // if prev_tk's word is longer, end has more weight, and tk's len will be shorter.
                    targetTk.end = brokenTk.bgn;
                    console.log('Smoothed prev --> ', brokenTk, targetTk);
                }
            };
            for (var j = 0; j < talkens.length; j++) {
                var tk = talkens[j];
                if (tk.bgn === tk.end) {
                    var prev_tk = j > 0 ? talkens[j - 1] : null;
                    var next_tk = nextTalken(j + 1, talkens);
                    if (!prev_tk) {
                        // smooth by stealing some of the next talken's playtime
                        smooth(tk, next_tk, true);
                    } else {
                        if (next_tk === null || prev_tk.end - prev_tk.bgn > next_tk.end - next_tk.bgn) smooth(tk, prev_tk, false);else smooth(tk, next_tk, true);
                    }
                }
            }
        };
        var smoothMissingTimestamps = pub.smoothMissingTimestamps;

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
            var PAUSE_MAX_MS = 700; // cap pauses at a full second
            for (var i = 1; i < words.length; i++) {
                var word = words[i].replace(/[.,-\/#!?$%\^&\*;:{}=\-_`~()]/g, ""); // strip any punctuation (just in case)
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
                    ssml += '<break time="' + Math.round(r2.util.dampPauseLength(breaks[i] / 1000.0) * 1000.0).toString() + 'ms"></break> ';
                } else ssml += wrd + ' ';
            }

            return ssml;
        };
        pub.toSSML = toSSML;

        var getTTSAudioURL = function getTTSAudioURL(ssml) {
            var voice = arguments.length <= 1 || arguments[1] === undefined ? "en-US_MichaelVoice" : arguments[1];

            var $dummy_ta = $('<textarea>');
            $dummy_ta.val(ssml);

            return 'https://newspeak-tts.mybluemix.net/synthesize?text' + $.param($dummy_ta) + '&voice=' + voice;
        };
        pub.getStreamingTTSAudioURL = function (ssml, voice) {
            return getTTSAudioURL(ssml, voice) + '&audio%2Fogg&codecs=opus';
        };
        pub.getTTSAudioURL = getTTSAudioURL;

        /**
         * Get synthesized audio from IBM Watson.
         * @param  {string} ssml - Transcript as SSML
         * @return {Promise}     - Returns url to the TTS audio blob.
         */
        var getTTSAudioFromWatson = function getTTSAudioFromWatson(ssml, voice) {
            if (typeof voice === "undefined") voice = "en-US_MichaelVoice";

            var $dummy_ta = $('<textarea>');
            $dummy_ta.val(ssml);

            // TODO:
            // 0. Remove need for jQuery serialization call
            // 1. Abstract away from hardcoding the base app URL.
            // 2. Change from GET to POST request.
            // 3. Make voice (e.g. Michael) customizable!
            // 4. MAYBE: Split ssml into multiple chunks if it's long...
            var tts_audiourl = getTTSAudioURL(ssml, voice);

            if (STREAM_TTS) {
                tts_audiourl += '&audio%2Fogg&codecs=opus';

                // Let's try this. If the user tries to play, I assume the browser will recognize that
                // it's already downloading this file. This way we separate r2.audioPlayer from this method entirely.
                // Ogg is still required, but WAV was recognized as a DIFFERENT IP endpoint, so it blocked the DL.
                return new Promise(function (resolve, reject) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', tts_audiourl, true);
                    xhr.responseType = 'blob';
                    xhr.onload = function (e) {
                        if (this.status == 200) {

                            r2App.annots[r2.speak.GetCurrentAnnotId()].SetRecordingAudioFileUrl(URL.createObjectURL(this.response), null);

                            // Read blob into array buffer
                            var myReader = new FileReader();
                            myReader.addEventListener("loadend", function (e) {
                                var uInt8Array = new Uint8Array(myReader.result);

                                r2.oggOpusDecoder.convertArrayBufferToWAV(uInt8Array).then(function (wavURL) {

                                    console.log('||| GOT WAV FROM OPUS ||| --> ', wavURL);
                                    r2App.annots[r2.speak.GetCurrentAnnotId()].SetRecordingAudioFileUrl(wavURL, null);

                                    ////// --> send to praat
                                    resolve(wavURL);
                                }).catch(function (err) {
                                    reject(err);
                                });
                            });
                            myReader.readAsArrayBuffer(this.response);
                        }
                    };
                    xhr.send();
                    pub.lastTTSAudioXHR = xhr;
                });

                /*return new Promise(function(resolve, reject) {
                    r2.audioPlayer.setLoadCallback(tts_audiourl, function(m_audio) {
                        console.log('||| GOT AUDIO ELEM FROM AUDIOPLAYER |||');
                         r2.oggOpusDecoder.convertToWAV(m_audio).then(function(wavURL) {
                             console.log('||| GOT WAV FROM OPUS |||');
                             ////// --> send to praat
                            resolve(wavURL);
                            ///r2App.annots[annotId].SetRecordingAudioFileUrl(wavURL, null);
                         });
                    });
                    r2.audioPlayer.load(r2.speak.GetCurrentAnnotId(), tts_audiourl, function(m_audio) {
                        //m_audio.defaultMuted = true;
                        //m_audio.play();
                        //m_audio.stop();
                    }, null); // load the audio*/
                /*r2.audioPlayer.play(r2.speak.GetCurrentAnnotId(), tts_audiourl, 0,
                    function(m_audio) {
                        m_audio.defaultMuted = true;
                    }, r2.audioPlayer.stop()); // Force it to download without playing it.*/
                //});
            } else {
                    tts_audiourl += '&accept=audio/wav';
                    console.log("Downloading TTS from url ", tts_audiourl);

                    // Request Watson TTS server
                    return new Promise(function (resolve, reject) {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', tts_audiourl, true);
                        xhr.responseType = 'blob';
                        xhr.onreadystatechange = function (e) {
                            if (this.readyState == 4 && this.status == 200) {
                                var blob = this.response;
                                resolve(URL.createObjectURL(blob));
                            } else if (this.status !== 200) reject("Error getting TTS response from Watson. Status: " + this.status);
                        };
                        xhr.send();
                        pub.lastTTSAudioXHR = xhr;
                    });
                }
        };
        pub.lastTTSAudioXHR = null;
        pub.abortDownloadOfTTSAudio = function () {
            if (pub.lastTTSAudioXHR) {
                pub.lastTTSAudioXHR.abort();
                pub.lastTTSAudioXHR = null;
            }
        };
        pub.getTTSTalkensFromWatson = function (ssml, voice, transcript) {
            return getTTSAudioFromWatson(ssml, voice).then(function (turl) {
                return r2.speak.Talken.generateFromHTK(turl, transcript);
            }).then(function (tts_talkens) {
                smoothMissingTimestamps(tts_talkens);
                return new Promise(function (resolve, reject) {
                    resolve(tts_talkens);
                });
            });
        };
        var getTTSTalkensFromWatson = pub.getTTSTalkensFromWatson;

        /**
         * Stitches timestamps together into a single audio file.
         * NOTE: Forgiving. If talken has no audio file, this function skips it.
         * Please use isStitchable to check whether an audio file is missing.
         * @param  {[Talken]} talkens - An array of Talkens
         * @return {Promise}          - A Promise passing the audio URL.
         */
        pub.stitch = function (talkens) {
            var snippets = [];
            var stitched_tks = [];
            var c = 0;
            talkens.forEach(function (t) {
                if (!t.audio || typeof t.audio === "undefined" || !t.audio.url) return;
                snippets.push({
                    'url': t.audio.url,
                    't_bgn': t.bgn,
                    't_end': t.end
                });
                stitched_tks.push({
                    'word': t.word,
                    'bgn': c,
                    'end': c + (t.end - t.bgn),
                    'audio': t.audio
                });
                c += t.end - t.bgn;
                if (t.pauseAfter > 0) {
                    var pausesnip = { 'url': 'static_audio/pauseResource.wav', 't_bgn': 0, 't_end': Math.min(r2.util.dampPauseLength(t.pauseAfter / 1000.0), 1.0) };
                    c += pausesnip.t_end;
                    snippets.push(pausesnip);
                }
            });

            return new Promise(function (resolve, reject) {
                r2.audioStitcher.run(snippets, function (url) {
                    if (!url) reject("r2.audiosynth.stitch: URL is null.");

                    resolve({ 'url': url, 'stitched_talkens': stitched_tks });
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
                return getTTSAudioFromWatson(ssml, 'en-US_MichaelVoice').then(function (url) {
                    return new Promise(function (resolve, reject) {
                        resolve(url);
                    });
                });
            }

            // (2) Perform post-processing.
            var orig_src_ts = toTimestamps(talkens);
            var src_ts;
            var transcript = toTranscript(talkens);
            var srcwav, twav;
            return stitch(talkens).then(function (sobj) {
                srcwav = sobj.url;
                src_ts = toTimestamps(sobj.stitched_talkens);
                return getTTSAudioFromWatson(ssml);
            }).then(function (turl) {
                twav = turl; // url
                return Praat.calcTimestamps(twav, transcript);
            }).then(function (target_ts) {
                // Calculate timestamps for TTS using forced alignment.
                console.log('synthesize: Performed forced alignment. Checking data...');
                if (!target_ts) throw 'No timestamps returned.';else if (target_ts.length !== orig_src_ts.length) throw 'Timestamp data mismatch: ' + src_ts.length + ' != ' + target_ts.length;
                console.log('synthesize: Data checked. Transferring prosody...');
                return Praat.transfer(srcwav, twav, src_ts, target_ts, config.transfer); // Transfer properties from speech to TTS waveform.
            }).then(function (resynth_blob) {
                // Transfer blob data to URL
                var url = (window.URL || window.webkitURL).createObjectURL(resynth_blob);
                return new Promise(function (resolve, reject) {
                    resolve(url);
                });
            }).catch(function (err) {
                console.log('Error @ synthesize: ', err);
            });
        };

        // This will perform magic.
        pub.patchSynthesize = function (talkens, prevTalkens, prevTTSTalkens) {
            console.log('####### Reached inner PS with args: ', talkens, prevTalkens, prevTTSTalkens);

            if (!prevTalkens || !prevTTSTalkens) {
                var ssml = toSSML(talkens);
                var transcript = toTranscript(talkens);
                var talkensCopy = r2.speak.Talken.clone(talkens);
                return getTTSTalkensFromWatson(ssml, 'en-US_MichaelVoice', transcript).then(function (tts_talkens) {
                    return new Promise(function (resolve, reject) {
                        resolve([talkensCopy, tts_talkens]);
                    });
                });
            }

            talkens = r2.speak.Talken.clone(talkens);
            if (prevTalkens) prevTalkens = r2.speak.Talken.clone(prevTalkens);
            if (prevTTSTalkens) prevTTSTalkens = r2.speak.Talken.clone(prevTTSTalkens);

            console.log('####### clone inner PS with args: ', talkens, prevTalkens, prevTTSTalkens);

            function contains(word, chararr) {
                var _iteratorNormalCompletion4 = true;
                var _didIteratorError4 = false;
                var _iteratorError4 = undefined;

                try {
                    for (var _iterator4 = chararr[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                        var o = _step4.value;

                        if (word.indexOf(o) > -1) return true;
                    }
                } catch (err) {
                    _didIteratorError4 = true;
                    _iteratorError4 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion4 && _iterator4.return) {
                            _iterator4.return();
                        }
                    } finally {
                        if (_didIteratorError4) {
                            throw _iteratorError4;
                        }
                    }
                }

                return false;
            }

            function splitResponsibly(tks) {
                var idxs = [0];
                var i = 0;
                var PAUSE_SPLIT_THRESHOLD = 500;
                var delimiters = ['.', '?', '!'];
                var _iteratorNormalCompletion5 = true;
                var _didIteratorError5 = false;
                var _iteratorError5 = undefined;

                try {
                    for (var _iterator5 = tks[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                        var t = _step5.value;

                        if (contains(t.word, delimiters) || t.pauseAfter >= PAUSE_SPLIT_THRESHOLD) {
                            idxs.push(i + 1);
                        } else if (t.pauseBefore >= PAUSE_SPLIT_THRESHOLD) {
                            idxs.push(i);
                        }
                        i++;
                    }
                } catch (err) {
                    _didIteratorError5 = true;
                    _iteratorError5 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion5 && _iterator5.return) {
                            _iterator5.return();
                        }
                    } finally {
                        if (_didIteratorError5) {
                            throw _iteratorError5;
                        }
                    }
                }

                console.log('Splitting ', tks, ' with idxs ', idxs);

                var b = -1;
                var split_tks = [];
                var _iteratorNormalCompletion6 = true;
                var _didIteratorError6 = false;
                var _iteratorError6 = undefined;

                try {
                    for (var _iterator6 = idxs[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                        var _i = _step6.value;

                        if (b > -1) {
                            split_tks.push(tks.slice(b, _i));
                            console.log(' >>> split from ', b, ' to ', _i);
                        }
                        b = _i;
                    }
                } catch (err) {
                    _didIteratorError6 = true;
                    _iteratorError6 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion6 && _iterator6.return) {
                            _iterator6.return();
                        }
                    } finally {
                        if (_didIteratorError6) {
                            throw _iteratorError6;
                        }
                    }
                }

                if (b > -1 && b < tks.length) {
                    split_tks.push(tks.slice(b));
                    console.log(' >>> split from ', b, ' to end');
                }

                return split_tks;
            }
            function mirrorSplit(template_sqs, arr) {
                var i = 0;
                var m = [];
                var _iteratorNormalCompletion7 = true;
                var _didIteratorError7 = false;
                var _iteratorError7 = undefined;

                try {
                    for (var _iterator7 = template_sqs[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                        var t = _step7.value;

                        m.push(arr.slice(i, i + t.length));
                        i += t.length;
                    }
                } catch (err) {
                    _didIteratorError7 = true;
                    _iteratorError7 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion7 && _iterator7.return) {
                            _iterator7.return();
                        }
                    } finally {
                        if (_didIteratorError7) {
                            throw _iteratorError7;
                        }
                    }
                }

                if (i < template_sqs.length) m.push(arr.slice(i));
                return m;
            }

            function talkenSequencesAreEqual(a, b) {
                console.log(' >> talkenSequencesAreEqual called with ', a, b);
                if (a.length !== b.length) return false;
                for (var i = 0; i < a.length; i++) {
                    if (a[i].word.toLowerCase() !== b[i].word.toLowerCase()) return false;
                }
                console.log(' >>> ...These sequences are equal.');
                return true;
            }

            function mergeAdjacent(arr, comparefunc, mergefunc) {
                for (var i = 0; i < arr.length - 1; i++) {
                    if (comparefunc(arr[i], arr[i + 1])) {
                        arr.splice(i, 2, mergefunc(arr[i], arr[i + 1]));
                        i--;
                    }
                }
                return arr;
            }

            var tks_sequences = splitResponsibly(talkens);
            var prev_tks_sequences = splitResponsibly(prevTalkens);
            var TTS_sequences = mirrorSplit(prev_tks_sequences, prevTTSTalkens);

            console.log('####### tks_seq, prev_tks_seq, tts_seq: ', tks_sequences, prev_tks_sequences, TTS_sequences);

            // S^2 comparison...
            var patchy_sequence = [];
            tks_sequences.forEach(function (s) {
                var i = 0;
                var noseq = true;
                var _iteratorNormalCompletion8 = true;
                var _didIteratorError8 = false;
                var _iteratorError8 = undefined;

                try {
                    for (var _iterator8 = prev_tks_sequences[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
                        var p = _step8.value;

                        if (talkenSequencesAreEqual(s, p)) {
                            patchy_sequence.push([true, TTS_sequences[i]]);
                            noseq = false;
                            break;
                        }
                        i++;
                    }
                } catch (err) {
                    _didIteratorError8 = true;
                    _iteratorError8 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion8 && _iterator8.return) {
                            _iterator8.return();
                        }
                    } finally {
                        if (_didIteratorError8) {
                            throw _iteratorError8;
                        }
                    }
                }

                if (noseq) patchy_sequence.push([false, s]);
            });

            // Merge adjacent sequences in advance to reduce the number of async calls.
            mergeAdjacent(patchy_sequence, function (curr, next) {
                return curr[0] === next[0];
            }, function (a, b) {
                return [a[0], a[1].concat(b[1])];
            });

            console.log('####### patchy_sequence: ', patchy_sequence);

            // patchy_sequence is now in the form:
            // -- [tts0, tts1, a, b, tts2] --
            // where tts_i stands for sequences which we already downloaded.
            // For these sequences, the audio should be extracted into a single snippet for stitching.
            // For new sequences, we will daisy-chain download requests to Watson.
            // ===================================
            // The output of the below chain of promises should be an array
            // of final TTS talken sequences. This will be flattened and then mapped (lol)
            // to an array of snippets for stitching. The flattened TTS talken array will
            // then be reconstructed into sequential timestamps corresponding to the
            // stitched audio and its URL.
            var composed_seq = patchy_sequence.reduce(function (prev, item_to_convert) {
                return prev.then(function (prev_tts_tks) {

                    console.log(' >>> Reducing patchy_sequence item: ', item_to_convert);

                    if (item_to_convert[0]) return new Promise(function (resolve, reject) {
                        resolve(prev_tts_tks.concat(item_to_convert[1]));
                    });else return new Promise(function (resolve, reject) {
                        var ssml = toSSML(item_to_convert[1]);
                        var transcript = toTranscript(item_to_convert[1]);
                        getTTSTalkensFromWatson(ssml, 'en-US_MichaelVoice', transcript).then(function (new_tts_tks) {
                            resolve(prev_tts_tks.concat(new_tts_tks));
                        });
                    });
                });
            }, new Promise(function (resolve, reject) {
                resolve([]);
            }));

            return composed_seq.then(function (final_tts_tks) {

                console.log(' >>> Stitching final tts talkens... ', final_tts_tks);

                return new Promise(function (resolve, reject) {
                    stitch(final_tts_tks).then(function (sobj) {

                        var tts_tks = sobj.stitched_talkens;

                        // Reconstruct talken seq to use stitched audio.
                        var ts = [];
                        var _iteratorNormalCompletion9 = true;
                        var _didIteratorError9 = false;
                        var _iteratorError9 = undefined;

                        try {
                            for (var _iterator9 = tts_tks[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
                                var tk = _step9.value;

                                ts.push([tk.word, tk.bgn, tk.end]);
                            }
                        } catch (err) {
                            _didIteratorError9 = true;
                            _iteratorError9 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion9 && _iterator9.return) {
                                    _iterator9.return();
                                }
                            } finally {
                                if (_didIteratorError9) {
                                    throw _iteratorError9;
                                }
                            }
                        }

                        console.log(' >>> Generating final stitched tts talkens...', ts, sobj);

                        // Generate stitched talken sequence and return to outer Promise.
                        resolve(r2.speak.Talken.generate(ts, sobj.url));
                    });
                });
            }).then(function (stitched_tts_tks) {
                return new Promise(function (resolve, reject) {
                    resolve([talkens, stitched_tts_tks]);
                });
            }); // Returns the stitched talken sequence (sequential timestamps that point to 1 audio URL)
        };

        /**
         * r2.audiosynth.patch
         * Downloads or patches audio for talkens missing audio.
         * Called in preparation for stitching _natural audio_.
         * @param  {[Talken]} talkens - An array of talkens
         * @return {Promise}          - Returns when the last audio is patched.
         */
        pub.patch = function (talkens) {

            //mode = 'TTS'; // in the future, patch could use previous words the user said...
            talkens = r2.speak.Talken.clone(talkens); // to be safe

            // Check for gaps. If there are none, we can perform a simple stitch.
            var isGap = function isGap(tk) {
                return !tk.audio || !tk.audio.url || tk.bgn === tk.end;
            };
            var hasGaps = function hasGaps(tks) {
                return tks.reduce(function (prevtk, curtk) {
                    return prevtk || isGap(curtk);
                });
            };
            if (!hasGaps(talkens)) return stitch(talkens);

            // If gaps exist:
            // (A) Todo: Get stored words from DB.
            // (B) Download TTS audio, run it through HTK,
            // smooth the response, and patch missing segments with TTS audio.
            var ssml = toSSML(talkens);
            var transcript = toTranscript(talkens).replace(/[.,-\/#!?$%\^&\*;:{}=\-_`~()]/g, "");
            return getTTSAudioFromWatson(toSSML(talkens)).then(function (turl) {
                return r2.speak.Talken.generateFromHTK(turl, transcript);
            }).then(function (tts_talkens) {
                smoothMissingTimestamps(tts_talkens);

                console.log('TTS talkens: ', tts_talkens);

                // Repair missing talkens in natural audio w/ TTS audio.
                var len = talkens.length;
                for (var i = 0; i < len; i++) {
                    if (isGap(talkens[i])) {
                        talkens[i].audio = { 'url': tts_talkens[i].audio.annotId }; // we don't want to use an annotId when stitching
                        talkens[i].bgn = tts_talkens[i].bgn;
                        talkens[i].end = tts_talkens[i].end;
                    }
                }

                console.log('Repaired talkens: ', talkens);

                // Stitch patched audio.
                return stitch(talkens);
            });
        };

        return pub;
    }();
})(window.r2 = window.r2 || {});
