
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

    simplespeech.ui = function(_textbox, _overlay, cbOnEdit) {
        var pub = {};

        // DOM elements
        var $textbox = $(_textbox);
        var $overlay = $(_overlay);

        // Edit history
        var edit_history;
        pub.getEditHistory = function() {
            return edit_history;
        };

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

        // Init
        var _init = function() {

            // Init edit history
            edit_history = new EditHistory();
            edit_history.listen(pub, cbOnEdit);

            // Setup event handlers
            $textbox[0].addEventListener('keydown', onKeyDown);
            document.onselectionchange = onSelectionChange;
        };

        pub.set = function(txt) {
            // Add words (set initial state)
            var words = txt.split(' '); var $vt, $ct, uid;
            var setops = [];
            words.forEach(function(word) {
                uid = createTalken(word);
                setops.push([uid, word]);
            });

            renderViewTalkens();

            if (pub.onset) pub.onset(setops);
        };

        pub.setCaptionTemporary = function(words){
            removeTempTalkens();
            words.forEach(function(word){
                createTalken(word[0], true); // is_temp = true
            });
            renderViewTalkens();
        };
        pub.setCaptionFinal = function(words){
            removeTempTalkens();
            words.forEach(function(word){
                createTalken(word[0], false); // is_temp = false
            });
            renderViewTalkens();
        };
        pub.doneCaptioning = function(){

        };

        var createTalken = function(word, is_temp){
            function newViewTalken(uid, word) {
                var $vt = $(document.createElement('div'));
                $vt.addClass('ssui-viewtalken');
                $vt.attr('uid', uid);

                var $vt_span = $(document.createElement('span'));
                $vt_span.addClass('ssui-viewtalken-span');
                $vt_span.text(word);
                $vt.append($vt_span);

                if (word.indexOf('\xa0') === -1) $vt.addClass('ssui-blue'); // blue if not a space
                else $vt.addClass('pause');
                return $vt;
            }
            function newCtrlTalken($vt, uid, word) {
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.text('\xa0');

                $ct[0].$vt_rect = $vt[0].getBoundingClientRect();
                $ct.css('letter-spacing', transferPx2Em($ct[0].$vt_rect.width, r2Const.SIMPLESPEECH_FONT_SIZE));
                $ct.attr('uid', uid);
                $ct.attr('word', word);
                $ct[0].$vt = $vt; // cache the view_talken corresponding to this ctrl_talken
                return $ct;
            }

            var uid = r2.util.generateGuid();

            var $vt = newViewTalken(uid, word);
            $overlay.append($vt);

            var $ct = newCtrlTalken($vt, uid, word);
            $textbox.append($ct);

            if(is_temp){
                $vt.toggleClass('temp', true);
                $ct.toggleClass('temp', true);
            }

            return uid;
        };

        var removeTempTalkens = function(){
            $overlay.find('.temp').remove();
            $textbox.find('.temp').remove();
        };

        var renderViewTalkens = function(){
            $textbox.children('span').each(function(idx) {
                positionViewTalken($(this), $textbox);
            });
        };

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
                if(e.keyCode === r2.keyboard.CONST.KEY_SPACE) {
                }
                e.preventDefault();
            }
        };
        var onSelectionChange = function(e){

            console.log(
                'selection_change'
            );
            console.log(
                window.getSelection().anchorNode.parentNode,
                window.getSelection().focusNode.parentNode,
                window.getSelection().anchorOffset,
                window.getSelection().focusOffset,
                window.getSelection().isCollapsed
            );
        };

        var positionViewTalken = function($ctrl_talken, $edit_box){
            var $vt = $ctrl_talken[0].$vt;

            var ct_rect = $ctrl_talken[0].getBoundingClientRect();
            var eb_rect = $edit_box[0].getBoundingClientRect();

            var dx = (ct_rect.width-$ctrl_talken[0].$vt_rect.width)*0.5;
            $vt.css('left', transferPx2Em(ct_rect.left - eb_rect.left + dx, 1.0));
            $vt.css('top', transferPx2Em(ct_rect.top - eb_rect.top, 1.0));
        };

        // Utils
        function caret() {
            return getCaretOffset($textbox[0]); // no idea why its -67
        }
        function overlayAtIndex(c) {
            return $($overlay.children()[c-2]);
        }
        function spanAtIndex(c) {
            return $($textbox.children()[c-1]);
        }

        function transferPx2Em(px, this_font_size){
            return px*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth()/this_font_size+'em';
        }

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
