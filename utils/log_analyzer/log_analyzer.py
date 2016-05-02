import ConfigParser, os
import traceback
import re
import json
import simplejson

CONFIG_FILE_PATH = 'setting.cfg'
CONFIG_SECTION = 'UserStudyLogAnalyzer'

class Utils(object):
    @staticmethod
    def getWER(edited_str, wav_filename):
        wav_filename = wav_filename[wav_filename.rfind('/')+1:]
        return 0.0

class ConfigFile(object):
    def __init__(self, filepath):
        self.config = ConfigParser.ConfigParser()
        try:
            self.config.readfp(open(filepath))
        except IOError as e:
            self.setDefault()
            self.save(filepath)
        except Exception as e:
            raise e

    def setDefault(self):
        self.config.add_section('UserStudyLogAnalyzer')
        self.config.set(CONFIG_SECTION, 'logpath', './Dropbox/UIST16-Interviews/TestAnalyzer')
        self.config.set(CONFIG_SECTION, 'pattern', 'par[0-9]+')

    def save(self, filepath):
        with open(filepath, 'wb') as f:
            self.config.write(f)

    def get(self, option):
        p = self.config.get(CONFIG_SECTION, option)
        if option == 'LogPath' and os.path.isdir(p) == False:
            raise Exception('LogFilePathNotFound', p)
        return p

class All(object):
    def __init__(self, path, pattern):
        self.participants = []
        dirs = [dir for dir in os.listdir(path) if os.path.isdir(os.path.join(path, dir))]
        for dir in dirs:
            if re.match(pattern, dir) != None:
                self.participants.append(Participant(os.path.join(path, dir)))

class Participant(object):
    def __init__(self, path):
        self.sessions = {}
        conds = ['ns', 'ss']
        for cond in conds:
            cond_path = os.path.join(path, cond)
            dirs = [dir for dir in os.listdir(cond_path) if os.path.isdir(os.path.join(cond_path, dir))]
            if len(dirs) == 0:
                self.sessions[cond] = self.loadByTime(cond_path, cond)

            else:
                self.sessions[cond] = self.loadByDir(cond_path, cond, dirs)

    def loadByTime(self, path, cond):
        print path
        js_files = [item for item in os.listdir(path) if os.path.splitext(item)[1] == '.json']
        js_files.sort()
        if cond == 'ns':
            return [NewSpeakSession(path, js) for js in js_files]
        elif cond == 'ss':
            return [SimpleSpeechSession(path, js) for js in js_files]

    def loadByDir(self, path, cond, dirs):
        print path
        js_paths = [
            [(dir, file) for file in os.listdir(os.path.join(path, dir)) if os.path.splitext(file)[1] == '.json']
            for dir in dirs
            ]
        for js_path in js_paths:
            if len(js_path) != 1:
                raise Exception('NotSingleJsonSession', path, js_path)
        js_paths = [js_path[0] for js_path in js_paths]

        if cond == 'ns':
            return [NewSpeakSession(os.path.join(path, js[0]), js[1]) for js in js_paths]
        elif cond == 'ss':
            return [SimpleSpeechSession(os.path.join(path, js[0]), js[1]) for js in js_paths]

class Session(object):
    def __init__(self, dir_path, file_path):
        print '    ', dir_path, file_path
        self.base_annots = {}
        with open(os.path.join(dir_path, file_path)) as f:
            self.data = simplejson.loads(f.read())
        self.preprocess()

    def preprocess(self):
        # preprocess before the analysis if needs be
        l = [datum['annotid'] for datum in self.data if datum['type'] == 'recordingStop']

        for base_annot in l:
            self.base_annots[base_annot['_id']] = base_annot

    def getRawAudioMeasures(self):
        """
        # non overriding measures are calculated in this function
            rec_len: length of each base recording
            n_gesture: number of gestures in each base recording

        # overriding measures have to be implemented in the derived Session classes
            n_words: number of total words (non-pause tokens)
            WER: Word error rate after user editing (both in SimpleSpeech and NewSpeak)
        """

        def getFromAnnot(annot):
            rtn_annot = {}
            rtn_annot['rec_len'] = annot['_duration']/1000.
            rtn_annot['n_gesture'] = len(annot['_spotlights'])
            return rtn_annot

        rtn = {}
        base_annots = [datum['annotid'] for datum in self.data if datum['type'] == 'recordingStop']
        for base_annot in base_annots:
            rtn[base_annot['_id']] = getFromAnnot(base_annot)

        return rtn

    def getEndResultMeasures(self):
        """
        # non overriding measures are calculated in this function
            None

        # overriding measures have to be implemented in the derived Session classes
            rec_len: total length of the final recording
            n_gesture: number of gestures
            n_pauses: number of pauses
            t_pauses: total length of the pauses
            n_words: number of total words (non-pause tokens)
            WER: Word error rate after user editing (only in SimpleSpeech)
        """

        return {}

    def getNumOperations(self):
        """
        # non overriding measures are calculated in this function
            n_base_recs: # of base recordings
            t_total_base_recs: total length of base recordings

        # overriding measures have to be implemented in the derived Session classes
            n_total_pauses: # of total pauses in base recordings
            n_total_nonpauses: # of total nonpause tokens in base recordings
            n_total_tokens: # of total tokens in base recordings
            t_total_pauses: total length of pauses in base recordings
            n_deleted_pauses: # of delted pauses
            n_deleted_nonpauses: # of deleted nonpauses
            n_deleted_tokens: n_deleted_pauses + n_deleted_nonpauses
            t_total_deleted_pauses: total length of the deleted pauses
            n_copy: # of copy operations
            n_cut: # of cut operations
            n_paste: # of paste operations
            n_caption_fix: # of trascription editing
        """

        def getTimeTotalBaseRec():
            return sum([datum['annotid']['_duration'] for datum in self.data if datum['type'] == 'recordingStop'])/1000.

        map_measurename_to_logtype = {
            'n_base_recs': 'recordingStop',
            't_total_base_recs': getTimeTotalBaseRec
        }

        rtn = {}
        for measurename in map_measurename_to_logtype:
            v = map_measurename_to_logtype[measurename]
            if isinstance(v, basestring): #when it's a string
                rtn[measurename] = sum([1 for datum in self.data if datum['type'] == map_measurename_to_logtype[measurename]])
            elif hasattr(v, '__call__'): #when it's a function
                rtn[measurename] = v()
            else:
                pass # otherwise it's None

        return rtn

    def getTimeForOperations(self):
        """
        Modes:
        idle, recording, replaying, ns-editing, ss-editing-audio, ss-editing-trans
        :return:
        """

        l = [datum for datum in self.data if datum['type'] == 'mode-switch']
        accum = { #no need to override
            'idle': 0,
            'recording': 0,
            'replay': 0,
            'ns-editing': 0,
            'ss-editing-audio': 0,
            'ss-editing-trans': 0
        }

        for i in xrange(len(l)-1):
            if l[i]['data']['mode'] == 'undefined':
                accum[l[i+1]['data']['mode']] += (l[i+1]['time']-l[i]['time'])/1000.
            else:
                accum[l[i]['data']['mode']] += (l[i+1]['time']-l[i]['time'])/1000.

        return accum

class SimpleSpeechSession(Session):
    def __init__(self, dir_path, file_path):
        super(SimpleSpeechSession,self).__init__(dir_path, file_path)

    def preprocess(self):
        super(SimpleSpeechSession,self).preprocess()
        print '        - getTimeForOperations:  ', self.getTimeForOperations()
        print '        - getEndResultMeasures:  ', self.getEndResultMeasures()
        print '        - getNumOperations:      ', self.getNumOperations()
        print '        - getRawAudioMeasures:   ', self.getRawAudioMeasures()

    def getRawAudioMeasures(self):
        """
        # non overriding measures are calculated in this function
            rec_len: length of each base recording
            n_gesture: number of gestures in each base recording

        # overriding measures have to be implemented in the derived Session classes
            n_words: number of total words (non-pause tokens)
            WER: Word error rate after user editing (both in SimpleSpeech and NewSpeak)
        """
        rtn = super(SimpleSpeechSession,self).getRawAudioMeasures()

        def getNumWordsFromTokenData(token_data):
            return sum([1 for word in token_data['transcription']])

        def getWerFromDatum(datum, annotid):
            return Utils.getWER(
                ' '.join([word['word'] for word in datum['data']['transcription']]),
                self.base_annots[annotid]['_audiofileurl']
            )

        data = [datum for datum in self.data if datum['type'] == 'base-recording-end']
        for datum in data:
            transcription = datum['data']['transcription']
            if len(transcription) > 0:
                annotid = transcription[0]['data'][0]['annotid']
                rtn[annotid]['n_words'] = getNumWordsFromTokenData(datum['data'])
                rtn[annotid]['WER'] = getWerFromDatum(datum, annotid)
            else:
                raise Exception('BaseRecordingWithNoTranscription')
        return rtn


    def getEndResultMeasures(self):
        """
        # non overriding measures are calculated in this function
            None

        # overriding measures have to be implemented in the derived Session classes
            rec_len: total length of the final recording
            n_gesture: number of gestures
            n_pauses: number of pauses
            t_pauses: total length of the pauses
            n_words: number of total words (non-pause tokens)
            WER: Word error rate after user editing (only in SimpleSpeech)
        """
        rtn = super(SimpleSpeechSession,self).getEndResultMeasures()

        #setup
        l = [datum['data'] for datum in self.data if datum['type'] == 'end-result']
        l = sorted(l, key=lambda k: k['rendered_annot']['_duration'])
        datum = l[-1] # get the end result of the longest duration

        #get rec_len: total length of the final recording
        rtn['rec_len'] = datum['rendered_annot']['_duration']/1000.

        #get n_gesture: number of gestures
        rtn['n_gesture'] = len(datum['rendered_annot']['_spotlights'])

        #get n_pauses: number of pauses
        rtn['n_pauses'] = sum([1 for token in datum['data'] if token['word'] in [u'\xa0', ' ']])

        #get t_pauses: total length of the pauses
        t = 0
        for token in datum['data']:
            if  token['word'] in [u'\xa0', ' ']:
                t += token['data'][-1]['rendered_end']-token['data'][0]['rendered_bgn']
        rtn['t_pauses'] = t

        #get n_words: number of total words (non-pause tokens)
        rtn['n_words'] = sum([1 for token in datum['data'] if not token['word'] in [u'\xa0', ' ']])

        #get WER: Word error rate after user editing (only in SimpleSpeech)
        rtn['WER'] = Utils.getWER(
            ' '.join([token['word'] for token in datum['data'] if not token['word'] in [u'\xa0', ' ']]),
            datum['rendered_annot']['_audiofileurl']
        )

        return rtn


    def getNumOperations(self):
        rtn = super(SimpleSpeechSession,self).getNumOperations()

        def getTotalPauses():
            n = 0
            recordings = [datum['data']['transcription'] for datum in self.data if datum['type'] == 'base-recording-end']
            for token_data in recordings:
                for i in xrange(len(token_data)-1):
                    t_gap = token_data[i+1]['data'][0]['bgn'] - token_data[i]['data'][0]['end']
                    if t_gap > 0.03:
                        n += 1
            return n

        def getTotalNonpauses():
            n = 0
            l = [datum['data']['transcription'] for datum in self.data if datum['type'] == 'base-recording-end']
            for token_data in l:
                for token_datum in token_data:
                    n += 1
            return n

        def getTimeTotalPauseLength():
            t = 0
            recordings = [datum['data']['transcription'] for datum in self.data if datum['type'] == 'base-recording-end']
            for token_data in recordings:
                for i in xrange(len(token_data)-1):
                    t_gap = token_data[i+1]['data'][0]['bgn'] - token_data[i]['data'][0]['end']
                    if t_gap > 0.03:
                        t += t_gap
            return t

        def getTotalDeletedPauses():
            n = 0
            ops = [datum['data']['selected_text']['list'] for datum in self.data if datum['type'] == 'op-delete']
            for deleted_tolkens in ops:
                for token in deleted_tolkens:
                    if token['word'] in [u'\xa0', ' ']:
                        n += 1
            return n

        def getTotalDeletedNonpauses():
            n = 0
            ops = [datum['data']['selected_text']['list'] for datum in self.data if datum['type'] == 'op-delete']
            for deleted_tolkens in ops:
                for token in deleted_tolkens:
                    if not token['word'] in [u'\xa0', ' ']:
                        n += 1
            return n

        def getTimeTotalDeletedPauses():
            t = 0
            ops = [datum['data']['selected_text']['list'] for datum in self.data if datum['type'] == 'op-delete']
            for deleted_tolkens in ops:
                for token in deleted_tolkens:
                    if token['word'] in [u'\xa0', ' ']:
                        t += token['data'][-1]['rendered_end']-token['data'][0]['rendered_bgn']
            return t

        map_measurename_to_logtype = {
            'n_total_pauses': getTotalPauses, #override
            'n_total_nonpauses': getTotalNonpauses, #override
            'n_total_tokens': None, #override
            't_total_pauses': getTimeTotalPauseLength, #override
            'n_deleted_pauses': getTotalDeletedPauses, #override
            'n_deleted_nonpauses': getTotalDeletedNonpauses, #override
            'n_deleted_tokens': None, #override
            't_total_deleted_pauses': getTimeTotalDeletedPauses, #override
            'n_copy': 'copy', #override
            'n_cut': 'cut', #override
            'n_paste': 'paste', #override
            'n_caption_fix': 'cmd-edit-transcript-done' #override
        }

        for measurename in map_measurename_to_logtype:
            v = map_measurename_to_logtype[measurename]
            if isinstance(v, basestring): #when it's a string
                rtn[measurename] = sum([1 for datum in self.data if datum['type'] == map_measurename_to_logtype[measurename]])
            elif hasattr(v, '__call__'): #when it's a function
                rtn[measurename] = v()
            else:
                pass # otherwise it's None

        # None
        rtn['n_total_tokens'] = rtn['n_total_nonpauses'] + rtn['n_total_pauses']
        rtn['n_deleted_tokens'] = rtn['n_deleted_nonpauses'] + rtn['n_deleted_pauses']

        return rtn

class NewSpeakSession(Session):

    def __init__(self, dir_path, file_path):
        super(NewSpeakSession,self).__init__(dir_path, file_path)

    def preprocess(self):
        super(NewSpeakSession,self).preprocess()

    def getRawAudioMeasures(self):
        rtn = super(NewSpeakSession,self).getRawAudioMeasures()
        #note that rtn is a dictionary of each baseline_annot
        return rtn

    def getEndResultMeasures(self):
        pass

    def getNumOperations(self):
        pass


if __name__ == '__main__':
    try:
        configFile = ConfigFile(CONFIG_FILE_PATH)
        all = All(configFile.get('LogPath'), configFile.get('pattern'))
    except Exception as e:
        if e.args[0] == 'LogFilePathNotFound':
            print '>>> Exception'
            print '    Failed to find the folder:', e.args[1]
            print '    Please edit \'LogPath\' option in the config file:', CONFIG_FILE_PATH
        if e.args[0] == 'NotSingleJsonSession':
            print '>>> Exception'
            print '    Please check the folder:', e.args[1]
            print '    List of .json files', e.args[2]
        else:
            print e
            traceback.print_exc()
