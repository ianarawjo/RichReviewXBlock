import ConfigParser, os
import traceback
import re
import json

import simplejson

CONFIG_FILE_PATH = 'setting.cfg'
CONFIG_SECTION = 'UserStudyLogAnalyzer'

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
        # of baseline recordings
        Word error rate
        Recording length (t)
        # of words
        Use of gesture
        """
        rtn = {}

        l = [datum['annotid'] for datum in self.data if datum['type'] == 'recordingStop']
        for base_annot in l:
            rtn[base_annot['_id']] = {
                WER: 0,
                rec_leng: 0,
                n_gesture: 0,
                n_words: 0 # override
            }

        return rtn

    def getEndResultMeasures(self):
        """
        Word error rate
        Recording length (t)
        # of words
        Use of gesture
        # of pauses
        """
        return {
            WER: 0,
            rec_leng: 0,
            n_gesture: 0,
            n_words: 0 # override
        }

    def getNumOperations(self):
        """
        Navigation
        # of baseline recordings
        # of pauses
            Baseline pauses + their length.
        Audio editing
        # of pause deletion
        # of non-pause deletion
        # of copy/cut/paste operations
        Transcription editing

                :return:
        """
        return {
            n_base_recs: 0,
            n_pauses: 0, #override
            n_deleted_pauses: 0, #override
            n_deleted_nonpauses: 0, #override
            n_copy: 0, #override
            n_cut: 0, #override
            n_paste: 0, #override
            n_caption_fix: 0 #override
        }

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
        self.getTimeForOperations();

    def getRawAudioMeasures(self):
        pass

    def getEndResultMeasures(self):
        pass

    def getNumOperations(self):
        pass


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