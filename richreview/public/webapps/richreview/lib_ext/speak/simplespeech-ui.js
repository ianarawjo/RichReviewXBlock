
/**
 * Simplespeech-UI
 * An implementation of SS's UI as a contenteditable div.
 * This is the 'View' in MVC paradigm.
 * @module simplespeech
 * @requires jQuery
 * @author ian
 * Created by ian on 03/01/2016.
 */
(function(simplespeech) {
    'use strict';

    var EditHistory = function() {

        var base = [];
        var g = [];
        var edittype = { NONE: 0, INS: 1, DEL: 2, REPL: 3 };
        var op = function(type, idx, uid, word) {
            this.type = type;
            this.idx = idx;
            this.uid = uid;
            this.word = word;
        };

        var onchange = null;

        var onset = function(setops) {
            g = []; base = [];
            for(var i = 0; i < setops.length; ++i){
                var s = setops[i];
                base.push(new op(edittype.NONE, i, s[0], s[1]));
            }
        };

        var oninsert = function(idx, uid, word) {
            if (idx > g.length || idx < 0) {
                console.log("Error @ oninsert: Invalid index: ", idx);
                return;
            }
            g.push(new op(edittype.INS, idx, uid, word));
            if (onchange) onchange();
        };
        var onremove = function(idx, uid, word) {
            if (idx >= g.length || idx < 0) {
                console.log("Error @ onremove: Invalid index: ", idx);
                return;
            }
            g.push(new op(edittype.DEL, idx, uid, word));
            if (onchange) onchange();
        };
        var onreplace = function(idx, uid, word) {
            if (idx >= g.length || idx < 0) {
                console.log("Error @ onreplace: Invalid index: ", idx);
                return;
            }
            g.push(new op(edittype.REPL, idx, uid, word));
            if (onchange) onchange();
        };

        return {
            listen: function(ssui, cbOnChange) {
                ssui.oninsert = oninsert;
                ssui.onremove = onremove;
                ssui.onreplace = onreplace;
                ssui.onset = onset;
                onchange = cbOnChange;
            },
            disconnect: function() {
                ssui.oninsert = null;
                ssui.onremove = null;
                ssui.onreplace = null;
                ssui.onset = null;
                onchange = null;
            },

            /**
             * Applies edit ops to array (talkens, timestamps, etc) where each obj must have .word attribute.
             * createFunc should be a function which takes the op and returns a new obj to add to ts.
             */
            apply: function(ts, createFunc) {

                g.forEach(function(o){
                    if (o.type === edittype.INS) {
                        ts.splice(o.idx, 0, createFunc(o));
                    }
                    else if (o.type === edittype.DEL) {
                        ts.splice(o.idx, 1);
                    }
                    else if (o.type === edittype.REPL) {
                        ts[idx].word = o.word;
                    }
                });

                return ts;
            }
        };
    };

    simplespeech.ui = function(_textbox, _overlay) {
        var pub = {};

        // DOM elements
        var $textbox = $(_textbox);
        var $overlay = $(_overlay);
        var carret = {
            idx_anchor: 0,
            idx_focus: 0,
            is_collapsed: true,
            idx_bgn: 0,
            idx_end: 0
        };
        var copied_ctrl_talkens = [];

        // Listener callbacks
        /**
         * Callback when a change occurs to the EditHistory.
         */
        pub.onchange = null;

        /**
         * Fired when element is removed.
         * Function in form (index, uid, word).
         */
        pub.onremove = null;

        /**
         * Fired when element is inserted into the DOM.
         * Function in form (index, uid, word).
         */
        pub.oninsert = null;

        /**
         * Fired when element text is modified.
         * Function in form (index, uid, word).
         */
        pub.onreplace = null;

        /**
         * Fired when elements are first added (immediately after transcription).
         * Function in form ([uid, word]).
         */
        pub.onset = null;

        pub.on_input = null;

        // Init
        var _init = function() {

            // Setup event handlers
            $textbox[0].addEventListener('keydown', onKeyDown);
            document.onselectionchange = onSelectionChange;
        };

        pub.setCaptionTemporary = function(words){
            removeTempTalkens();
            words.forEach(function(data){
                var $ct = createTalken(data, true); // is_temp = true
                insertPauseTalken($textbox.children().last(), $ct, true);
                $textbox.append($ct);
            });
            renderViewTalkens();
        };
        pub.setCaptionFinal = function(words){
            removeTempTalkens();
            words.forEach(function(data){
                var $ct = createTalken(data, false); // is_temp = false
                insertPauseTalken($textbox.children().last(), $ct, false);
                $textbox.append($ct);
            });
            renderViewTalkens();
        };
        pub.getCtrlTalkens = function(url){
            var rtn = []
            $textbox.children().each(function(idx){
                this.word = this.data[0];
                this.bgn = this.data[1];
                this.end = this.data[2];
                this.audioURL = url;
                rtn.push($(this))
            });
            return rtn;
        };

        var insertPauseTalken = function($last, $ct, is_temp){
            if($last[0]){
                if($ct[0].data[1]-$last[0].data[2] > 0.3){
                    var $ct = createTalken(
                        ['\xa0', $last[0].data[2], $ct[0].data[1]],
                        is_temp // is_temp
                    );
                    $ct[0].$vt.addClass('ssui-pause');
                    $textbox.append($ct);
                }
            }
        };

        var createTalken = function(data, is_temp){
            var word = data[0];
            function newViewTalken(uid, word) {
                var $vt = $(document.createElement('div'));
                $vt.addClass('ssui-viewtalken');
                $vt.attr('uid', uid);

                var $vt_span = $(document.createElement('span'));
                $vt_span.addClass('ssui-viewtalken-span');
                $vt_span.text(word);
                $vt.append($vt_span);

                if (word.indexOf('\xa0') === -1){
                    $vt.addClass('ssui-word'); // blue if not a space
                }
                else{
                    $vt.addClass('ssui-pause');
                }
                return $vt;
            }
            function newCtrlTalken($vt, uid, word) {
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.text('\xa0');

                $ct[0].data = data;
                $ct[0].$vt = $vt; // cache the view_talken corresponding to this ctrl_talken
                $ct[0].$vt_rect = $vt[0].getBoundingClientRect();
                $ct.css('letter-spacing', transferPx2Em($ct[0].$vt_rect.width, r2Const.SIMPLESPEECH_FONT_SIZE));
                $ct.attr('uid', uid);
                $ct.attr('word', word);

                return $ct;
            }

            var uid = r2.util.generateGuid();

            var $vt = newViewTalken(uid, word);
            $overlay.append($vt);

            var $ct = newCtrlTalken($vt, uid, word);

            if(is_temp){
                $vt.toggleClass('temp', true);
                $ct.toggleClass('temp', true);
            }

            return $ct;
        };

        var removeTempTalkens = function(){
            $overlay.find('.temp').remove();
            $textbox.find('.temp').remove();
        };

        var renderViewTalkens = function(){
            var positionViewTalken = function($ctrl_talken, $edit_box){
                var $vt = $ctrl_talken[0].$vt;

                var ct_rect = $ctrl_talken[0].getBoundingClientRect();
                var eb_rect = $edit_box[0].getBoundingClientRect();

                var dx = (ct_rect.width-$ctrl_talken[0].$vt_rect.width)*0.5;
                $vt.css('left', transferPx2Em(ct_rect.left - eb_rect.left + dx, 1.0));
                $vt.css('top', transferPx2Em(ct_rect.top - eb_rect.top, 1.0));
            };

            $overlay.find('.ssui-viewtalken').remove();
            $textbox.children('span').each(function(idx) {
                $overlay.append(this.$vt);
                positionViewTalken($(this), $textbox);
            });
        };

        function transferPx2Em(px, this_font_size){
            return px*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth()/this_font_size+'em';
        }

        // Events
        var onKeyDown = function(e) {
            console.log('keyCode', e.keyCode);
            var key_enable_default = [
                r2.keyboard.CONST.KEY_LEFT,
                r2.keyboard.CONST.KEY_RGHT,
                r2.keyboard.CONST.KEY_UP,
                r2.keyboard.CONST.KEY_DN
            ];

            if(key_enable_default.indexOf(e.keyCode) > -1){

            }
            else {
                e.preventDefault();
                onSelectionChange();

                if(e.keyCode === r2.keyboard.CONST.KEY_DEL) {
                    if(carret.is_collapsed){
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end+1
                        );
                    }
                    else{
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_BSPACE) {
                    if(carret.is_collapsed){
                        op.remove(
                            carret.idx_bgn-1,
                            carret.idx_end
                        );
                    }
                    else{
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_C){
                    if(carret.is_collapsed){
                        ;
                    }
                    else{
                        op.copy(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_X){
                    if(carret.is_collapsed){
                        ;
                    }
                    else{
                        op.copy(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_V){
                    if(carret.is_collapsed){
                        op.paste(
                            carret.idx_focus
                        );
                    }
                    else{
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                        op.paste(
                            carret.idx_bgn
                        );
                    }
                }

                renderViewTalkens();

                if(pub.on_input)
                    pub.on_input();
            }
        };

        var onSelectionChange = function(e){
            var sel = window.getSelection();
            if(sel.anchorNode.parentNode.parentNode !== $textbox[0]){ // when focused to textbox
                sel = setCarret(sel.anchorOffset);
            }
            carret.idx_anchor = sel.anchorOffset + $textbox.children().index($(sel.anchorNode.parentNode));
            carret.idx_focus = sel.focusOffset + $textbox.children().index($(sel.focusNode.parentNode));

            carret.is_collapsed = sel.isCollapsed;

            carret.idx_bgn = Math.min(carret.idx_anchor, carret.idx_focus);
            carret.idx_end = Math.max(carret.idx_anchor, carret.idx_focus);
            console.log(carret.idx_bgn, carret.idx_end, carret.is_collapsed);
        };

        var setCarret = function(idx){
            var sel = window.getSelection();
            var range = document.createRange();
            if(idx!==0){
                var n = $textbox.children()[idx-1];
                range.setStartAfter(n);
            }
            else{
                var n = $textbox.children()[0];
                range.setStartBefore(n);
            }
            sel.removeAllRanges();
            sel.addRange(range);
            return sel;
        };

        var op = (function(){
            var pub_op = {};

            pub_op.remove = function(idx_bgn, idx_end){ // remove [idx_bgn,idx_end), note that 'idx_end' item is not included
                console.log('remove', idx_bgn, idx_end);
                $textbox.children().slice(idx_bgn, idx_end).remove();
            };

            pub_op.copy = function(idx_bgn, idx_end){
                copied_ctrl_talkens = $textbox.children().slice(idx_bgn, idx_end);
            };

            pub_op.paste = function(idx){

                function jquery_insert($target, $elem, idx){
                    var idx_last = $target.children().size();
                    $target.append($elem);
                    if (idx < idx_last) {
                        $target.children().eq(idx).before($target.children().last())
                    }
                }

                copied_ctrl_talkens.each(
                    function(){
                        jquery_insert($textbox, createTalken(this.data, false), idx);
                        ++idx;
                    }
                );
                setCarret(idx);
            };

            return pub_op;
        }());



        _init();

        return pub;
    };

    /* Thanks to Tim Down @ SO
    http://stackoverflow.com/questions/4811822/get-a-ranges-start-and-end-offsets-relative-to-its-parent-container/4812022#4812022 */
    function getCaretOffset(element) {
        var caretOffset = 0;
        var doc = element.ownerDocument || element.document;
        var win = doc.defaultView || doc.parentWindow;
        var sel;
        if (typeof win.getSelection != "undefined") {
            sel = win.getSelection();
            if (sel.rangeCount > 0) {
                var range = win.getSelection().getRangeAt(0);
                var preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(element);
                preCaretRange.setStart(preCaretRange.startContainer, 4);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                caretOffset = preCaretRange.toString().length;
            }
        } else if ( (sel = doc.selection) && sel.type != "Control") {
            var textRange = sel.createRange();
            var preCaretTextRange = doc.body.createTextRange();
            preCaretTextRange.moveToElementText(element);
            preCaretTextRange.setEndPoint("EndToEnd", textRange);
            caretOffset = preCaretTextRange.text.length;
        }
        return caretOffset;
    }

}(window.simplespeech = window.simplespeech || {}));
