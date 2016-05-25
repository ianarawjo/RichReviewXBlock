import ConfigParser, os
import traceback
import subprocess
import re
import json
import simplejson
import numpy as np
import scipy.stats as scistats

CONFIG_FILE_PATH = 'setting.cfg'
CONFIG_SECTION = 'UserStudyLogAnalyzer'

class Utils(object):
    path_transcription = ''

    @staticmethod
    def getWER(edited_str, wav_filename, audio_dir):
        txt_filename = wav_filename[wav_filename.rfind('/')+1:]+'.txt'
        audio_filepath = os.path.join(audio_dir,wav_filename[wav_filename.rfind('/')+1:])+'.wav'
        empty_trans = False
        try:
            with open(os.path.join(Utils.path_transcription, txt_filename)) as f:
                all_lines = f.read()
                if all_lines[:2] == '-1':
                    empty_trans = True
                    raise Exception('File not yet transcribed.')
                edited = [w.replace(".","").replace("'","").replace(",","").upper() for w in edited_str.split()]
                perfect = [w.replace(".","").replace("'","").replace(",","").upper() for w in all_lines.split()]
            return levenshtein(edited, perfect)/float(max(len(edited), len(perfect)))
        except Exception as e:
            print 'please complete transcript for (', txt_filename, ')', edited_str
            if not empty_trans:
                with open(os.path.join(Utils.path_transcription, txt_filename), 'w') as f:
                    f.write('-1')
            os.system('open ' + os.path.join(Utils.path_transcription, txt_filename))

            repl = ''
            raw_input("Press Enter to play sound " + audio_filepath + " when ready...")
            while len(repl) < 2:
                os.system('afplay ' + audio_filepath)
                repl = raw_input(" > Press Enter to replay. Press any other key + ENTER to continue.")

            #input("Press Enter to continue...")
            return -1

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
        self.config.set(CONFIG_SECTION, 'logpath', '../../../../Dropbox/UIST16-Interviews/Final')
        #self.config.set(CONFIG_SECTION, 'logpath', '../../../../Dropbox/UIST16-Interviews/TestAnalyzer')
        self.config.set(CONFIG_SECTION, 'transcriptionpath', '../../../../Dropbox/UIST16-Interviews/Final/transcription')
        self.config.set(CONFIG_SECTION, 'pattern', 'par[0-9]+|test|f[1-9]+')

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
        self.getStats()

    def getStats(self):
        data = {}
        conds = ['ns', 'ss']
        num_participants = len(self.participants)

        for part in self.participants:
            p_stats = part.getStats()

            # Add the stats for this participant to the ongoing total.
            for measure in p_stats: # i.e. optimes, rawaudio, endresult, numops
                if not measure in data:
                    data[measure] = {}

                for cond in conds: # ns or ss
                    if not cond in data[measure]:
                        data[measure][cond] = {}

                    avg_stats = {} # To reduce noise in the t-test, average this stat for each participant before appending.
                    for session in p_stats[measure][cond]: # this is an element of an array

                        for stat in session:
                            #print('measure ' + measure + ' in cond ' + cond + ' stat: ' + str(stat))

                            if session[stat] == None:
                                print(" > Skipping stat " + stat + ": NoneType error.")
                                continue

                            if not stat in avg_stats:
                                avg_stats[stat] = [session[stat]]
                            else:
                                avg_stats[stat].append(session[stat])

                    if measure == 'rawaudio':
                        flattened = {}
                        for base_annot in avg_stats:
                            #if len(avg_stats[base_annot]) > 0:
                            #    print("More than one set of stats in base_annot! ")
                            for i in xrange(len(avg_stats[base_annot])):
                                for stat in avg_stats[base_annot][i]:
                                    if not stat in flattened: flattened[stat] = []
                                    flattened[stat].append(avg_stats[base_annot][i][stat])
                        avg_stats = flattened

                    for stat in avg_stats:

                        # don't average the number of ops or end results...
                        if measure == 'numops' or measure == 'endresult':
                            #print(" > stat " + stat + ": " + str(avg_stats[stat]))

                            if not stat in data[measure][cond]:
                                data[measure][cond][stat] = avg_stats[stat] # initialize this stat in a list
                            else:
                                data[measure][cond][stat].extend(avg_stats[stat]) # add stat to list. DOESNT DISTINGUISH BY SESSION!
                            continue

                        p_avg = sum(avg_stats[stat]) / len(avg_stats[stat])
                        if not stat in data[measure][cond]:
                            data[measure][cond][stat] = [p_avg] # initialize this stat in a list
                        else:
                            data[measure][cond][stat].append(p_avg) # add stat to list. DOESNT DISTINGUISH BY SESSION!

        # Calculate means from totals
        ttest = {}
        for measure in data:
            ttest[measure] = {}

            for cond in data[measure]:

                ttest[measure][cond] = {}
                other_cond = 'ns' if cond == 'ss' else 'ss'
                stats = [stat for stat in data[measure][cond]]

                # Crunch stats over the data in this condition:
                for stat in stats:
                    if not stat in data[measure][other_cond]:
                        print (' Skipping stat in cond ' + cond + ': Not found in other condition, ' + other_cond + '.')
                        continue
                    if not stat in ttest[measure][cond]:
                        ttest[measure][cond][stat] = []

                    ttest[measure][cond][stat].extend(data[measure][cond][stat])

        # Perform ttests
        for measure in ttest:

            for stat in ttest[measure]['ns']:

                #    print('computing ttest for ' + measure + ' > ' + stat + ':: ', ttest[measure]['ns'][stat], '\n', ttest[measure]['ss'][stat])

                rst = scistats.ttest_rel(ttest[measure]['ns'][stat], ttest[measure]['ss'][stat])
                print(measure + ' > ' + stat + ':')
                print(' | t-test result is ' + str(rst))
                print(' | NewSpeak mean is ' + str(np.average(ttest[measure]['ns'][stat])))
                print(' | NewSpeak std is ' + str(np.std(ttest[measure]['ns'][stat])))
                print(' | SimpleSpeech mean is ' + str(np.average(ttest[measure]['ss'][stat])))
                print(' | SimpleSpeech std is ' + str(np.std(ttest[measure]['ss'][stat])))
                if rst[1] < 0.05: # if the p-value is < 1%, reject the null hypothesis
                    print(' | RESULT: ->>  variation in ' + stat + ' over conditions is statistically significant!')
                elif rst[1] < 0.1:
                    print(' | RESULT: ->>  variation in ' + stat + ' over conditions is trendy!')


        # for now
        #print(data)

class Participant(object):
    def __init__(self, path):
        self.sessions = {}
        self.name = os.path.basename(os.path.normpath(path))
        conds = ['ns', 'ss']
        for cond in conds:
            cond_path = os.path.join(path, cond)
            if not os.path.isdir(cond_path):
                print("Skipping path " + cond_path + ": Not a directory.")
                continue
            dirs = [dir for dir in os.listdir(cond_path) if os.path.isdir(os.path.join(cond_path, dir))]
            print("Reading dir " + str(dirs))
            if len(dirs) == 0:
                self.sessions[cond] = self.loadByTime(cond_path, cond)
            else:
                self.sessions[cond] = self.loadByDir(cond_path, cond, dirs)

    def getStats(self):
        if len(self.sessions) != 2:
            print("Cannot crunch ttest for participant: # of sessions != 2.")

        rtn = {}
        rtn['optimes'] = {}
        rtn['rawaudio'] = {}
        rtn['endresult'] = {}
        rtn['numops'] = {}

        conds = ['ns', 'ss']

        ''' Get operation times:
             > E.g. { 'optimes':{ 'ss':..., 'ns':... }, ... }
        '''
        for cond in conds:
            rtn['optimes'][cond] = [session.getTimeForOperations() for session in self.sessions[cond]]
            rtn['rawaudio'][cond] = [session.getRawAudioMeasures() for session in self.sessions[cond]]
            rtn['endresult'][cond] = [session.getEndResultMeasures() for session in self.sessions[cond]]
            rtn['numops'][cond] = [session.getNumOperations() for session in self.sessions[cond]]

        return rtn

    def loadByTime(self, path, cond):
        print path
        js_files = [item for item in os.listdir(path) if os.path.splitext(item)[1] == '.json']
        js_files.sort()
        print("loadByTime: skipping first log file: " + str(js_files[0]))
        js_files = js_files[1:]
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
        self.dir_path = dir_path
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
            n_replays: number of replays

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
            't_total_base_recs': getTimeTotalBaseRec,
            'n_replays': 'play'
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
            'ns-editing-text': 0,
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
        # print '        - getTimeForOperations:  ', self.getTimeForOperations()
        # print '        - getEndResultMeasures:  ', self.getEndResultMeasures()
        # print '        - getNumOperations:      ', self.getNumOperations()
        # print '        - getRawAudioMeasures:   ', self.getRawAudioMeasures()

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
                self.base_annots[annotid]['_audiofileurl'],
                self.dir_path
            )

        data = [datum for datum in self.data if datum['type'] == 'base-recording-end']
        for datum in data:
            transcription = datum['data']['transcription']
            if len(transcription) > 0:
                annotid = transcription[0]['data'][0]['annotid']
                rtn[annotid]['n_words'] = getNumWordsFromTokenData(datum['data'])
                #print(datum)
                rtn[annotid]['WER'] = getWerFromDatum(datum, annotid)
            else:
                # Should this really be an exception? It's possible they just didn't record anything.
                #raise Exception('BaseRecordingWithNoTranscription')
                #rtn[annotid]['n_words'] = 0
                #rtn[annotid]['WER'] = None
                pass
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
        print("rec_len @ SS: " + str(rtn['rec_len']))

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
            datum['rendered_annot']['_audiofileurl'],
            self.dir_path
        )

        return rtn


    def getNumOperations(self):
        rtn = super(SimpleSpeechSession,self).getNumOperations()

        # Get position of insertion
        def getRecBgnRightAfterTime(time):
            recbgn = None
            data = [datum for datum in self.data if datum['type'] == 'base-recording-bgn']
            for datum in data:
                if datum['time'] < time:
                    continue
                else:
                    recbgn = datum
                    break
            return recbgn

        rtn['n_insert_end'] = 0
        rtn['n_insert_mid'] = 0
        data = [datum for datum in self.data if datum['type'] == 'cmd-insertion']
        for datum in data:
            insert_idx = datum['data']['cursor_pos']
            talkens = getRecBgnRightAfterTime(datum['time'])['data']['talkenData']
            if insert_idx == 0 and len(talkens) == 0:
                continue # skip first insertion

            if insert_idx >= len(talkens) - 1:
                print(' >>>> inserted in at end ' + str(insert_idx))
                rtn['n_insert_end'] += 1
            else:
                print(' >>>> inserted in middle at ' + str(insert_idx) + ' of ' + str(len(talkens)))
                rtn['n_insert_mid'] += 1

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
        # print '        - getTimeForOperations:  ', self.getTimeForOperations()
        # print '        - getEndResultMeasures:  ', self.getEndResultMeasures()
        # print '        - getNumOperations:      ', self.getNumOperations()
        # print '        - getRawAudioMeasures:   ', self.getRawAudioMeasures()

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

            wav_file_path = self.dir_path + "/" + os.path.basename(annot['_audiofileurl']) + '.wav'
            process = subprocess.Popen(['ffmpeg',  '-i', wav_file_path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            stdout, stderr = process.communicate()

            matches = re.search(r"Duration:\s{1}(?P<hours>\d+?):(?P<minutes>\d+?):(?P<seconds>\d+\.\d+?),", stdout, re.DOTALL).groupdict()
            rtn_annot['rec_len'] = float(matches['minutes']) * 60.0 + float(matches['seconds'])
            print("getRawAudioMeasures -> rec_len @ NS: " + str(rtn_annot['rec_len']) + " | " + wav_file_path)

            rtn_annot['n_gesture'] = len(annot['_spotlights'])
            return rtn_annot

        rtn = {}
        base_annots = [datum['annotid'] for datum in self.data if datum['type'] == 'recordingStop']
        for base_annot in base_annots:
            rtn[base_annot['_id']] = getFromAnnot(base_annot)

        #rtn = super(NewSpeakSession,self).getRawAudioMeasures()

        def getWordsFromTokenData(token_data):
            return [word for word in token_data['talkenData'] if not word['word'] in [u'\xa0', ' ']]

        def getNumWordsFromTokenData(token_data):
            return len(getWordsFromTokenData(token_data))

        def getWerFromDatum(datum, annotid):
            wrds = getWordsFromTokenData(datum['data'])
            return Utils.getWER(
                ' '.join([word['word'] for word in wrds]),
                self.base_annots[annotid]['_audiofileurl'],
                self.dir_path
            )

        data = [datum for datum in self.data if datum['type'] == 'base-recording-end']
        for datum in data:
            transcription = datum['data']['talkenData']
            if len(transcription) > 0:
                annotid = transcription[0]['data'][0]['annotid']
                rtn[annotid]['n_words'] = getNumWordsFromTokenData(datum['data'])
                rtn[annotid]['WER'] = getWerFromDatum(datum, annotid)
            else:
                pass
                #raise Exception('BaseRecordingWithNoTranscription')
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
        rtn = super(NewSpeakSession,self).getEndResultMeasures()

        #setup
        l = [datum['data'] for datum in self.data if datum['type'] == 'end-result']
        if len(l) == 0:
            print("Skipping getEndResultMeasures @ NS: No end-result found.")
            return

        def srt_by_dur(k):
            if (len(k['rendered_annot']['_audiofileurl']) > 0):
                return k['rendered_annot']['_duration']
            else:
                return 0 # skip empty results
        l = sorted(l, key=srt_by_dur)
        datum = l[-1] # get the end result of the longest duration

        #get rec_len: total length of the final recording
        # rtn['rec_len'] = datum['rendered_annot']['_duration']/1000. # this is in error for some reason. instead we must get the duration of the audio directly.

        wav_file_path = self.dir_path + "/" + os.path.basename(os.path.normpath(datum['rendered_annot']['_audiofileurl']) + '.wav')
        process = subprocess.Popen(['ffmpeg',  '-i', wav_file_path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        stdout, stderr = process.communicate()

        matches = re.search(r"Duration:\s{1}(?P<hours>\d+?):(?P<minutes>\d+?):(?P<seconds>\d+\.\d+?),", stdout, re.DOTALL).groupdict()
        rtn['rec_len'] = float(matches['minutes']) * 60.0 + float(matches['seconds'])
        print("rec_len @ NS: " + str(rtn['rec_len']) + " | " + wav_file_path)

        #get n_gesture: number of gestures
        rtn['n_gesture'] = len(datum['rendered_annot']['_spotlights'])

        #get n_pauses: number of pauses
        edited_tks = datum['snapshot']['edited_talkens']
        rtn['n_pauses'] = sum([1 for token in edited_tks if token['word'] in [u'\xa0', ' ']])

        #get t_pauses: total length of the pauses
        t = 0
        for token in edited_tks:
            if token['word'] in [u'\xa0', ' ']:
                t += token['data'][0]['end']
        rtn['t_pauses'] = t

        #get n_words: number of total words (non-pause tokens)
        rtn['n_words'] = sum([1 for token in edited_tks if not token['word'] in [u'\xa0', ' ']])

        #get WER: Word error rate after user editing (only in SimpleSpeech)
        # rtn['WER'] = Utils.getWER(
        #     ' '.join([token['word'] for token in edited_tks if not token['word'] in [u'\xa0', ' ']]),
        #     datum['rendered_annot']['_audiofileurl'],
        #     self.dir_path
        # )

        return rtn

    def getNumOperations(self):
        rtn = super(NewSpeakSession,self).getNumOperations()

        # Get position of insertion
        rtn['n_insert_end'] = 0
        rtn['n_insert_mid'] = 0
        data = [datum for datum in self.data if datum['type'] == 'base-recording-bgn']
        for datum in data:
            text_snapshot = datum['data']['text_snapshot']
            insert_idx = datum['data']['idx']
            if insert_idx == -1: continue
            elif insert_idx >= len(text_snapshot) - 1:
                print(' >>>> NS inserted at end ' + str(insert_idx))
                rtn['n_insert_end'] += 1
            else:
                print(' >>>> NS inserted in middle at ' + str(insert_idx) + ' of ' + str(len(text_snapshot)))
                rtn['n_insert_mid'] += 1

        def onlyUnique(obj_arr):
            return obj_arr # fixMe
        def getSnapshots():
            logtypes = ['base-recording-pre-insert', 'base-recording-post-insert', 'end-result']
            ls = [(datum['data']['snapshot'], datum['time']) for datum in self.data if datum['type'] in logtypes] # snapshots whenever the edited tks are flattened
            ls = sorted(ls, key=lambda x:x[1])
            ls = [x for (x,y) in ls]
            return ls
        def getNumEditOpsOfType(op_type, ops):
            return sum([1 for op in ops if op['op'] == op_type])
        def sumEditOpsProperty(ops, prop):
            return sum(map(lambda x: x[prop], ops))
        def getNumEditOpsList(ops):
            n_unchanged = getNumEditOpsOfType('unchanged', ops)
            n_ins = getNumEditOpsOfType('ins', ops)
            n_del = getNumEditOpsOfType('del', ops)
            n_repl = getNumEditOpsOfType('repl', ops)
            n_unknown = getNumEditOpsOfType('unknown', ops)
            return [n_unchanged, n_ins, n_del, n_repl, n_unknown]
        def listsum(list_of_lists): # sum items in a list of lists, returning a single list
            if not list_of_lists or len(list_of_lists) == 0:
                return None
            elif len(list_of_lists) == 1:
                return list_of_lists
            else:
                return reduce((lambda prev,curr: [(t[0]+t[1]) for t in zip(prev,curr)]), list_of_lists)

        # (1) Extract all talken snapshots
        snapshots = onlyUnique(getSnapshots())

        # (2) Compute differential diff between each snapshot, marking what was deleted and what was added.
        #     (a) use type of op info (e.g. 'inserted' vs 'base-recording-end')
        #     (b) calc # of inserts + their avg position relative to the existing text (from 0 to 1)
        txt_op_summaries = []
        pause_op_summaries = []
        for snap in snapshots:
            edit_ops = snap['edit_ops']
            pause_ops = snap['pause_ops']
            #del_pause_len = sumEditOpsProperty(filter(lambda op: op['type']=='del', pause_ops), 'time')
            txt_op_summaries.append(getNumEditOpsList(edit_ops))
            pause_op_summaries.append(getNumEditOpsList(pause_ops))#.extend([del_pause_len]))

        # (3) Add up these operations to determine total # of operations.
        txt_op_totals = listsum(txt_op_summaries)
        pause_op_totals = listsum(pause_op_summaries)

        if not txt_op_totals or len(txt_op_totals) == 0:
            print("Error: No talken operations found in JSON.")
            return

        def getCumulativeBasePauses():
            n = 0
            recordings = [datum['data']['talkenData'] for datum in self.data if datum['type'] == 'base-recording-end']
            for token_data in recordings:
                for i in xrange(len(token_data)): # skip the final token, because a pause at the end of a sentence is meaningless
                    token = token_data[i]
                    if token['word'] in [u'\xa0', ' ']:
                        n += 1
            return n
        def getCumulativeBaseNonpauses():
            n = 0
            recordings = [datum['data']['talkenData'] for datum in self.data if datum['type'] == 'base-recording-end']
            for token_data in recordings:
                for i in xrange(len(token_data)):
                    token = token_data[i]
                    if not token['word'] in [u'\xa0', ' ']:
                        n += 1
            return n
        def getTotalBasePauseLength():
            n = 0
            recordings = [datum['data']['talkenData'] for datum in self.data if datum['type'] == 'base-recording-end']
            for token_data in recordings:
                for i in xrange(len(token_data)):
                    token = token_data[i]
                    if token['word'] in [u'\xa0', ' ']:
                        n += float(token['data'][0]['end'])
            return n
        def getTotalDeletedPauses():
            DEBUG_PRINT = False

            def _print(s):
                if DEBUG_PRINT: print(s)

            def getTextSnapshots():
                logtypes = ['base-recording-post-insert', 'base-recording-bgn', 'end-synthesis', 'end-result']
                ls = [(datum['data']['text_snapshot'], datum['time'], datum['type']) for datum in self.data if datum['type'] in logtypes]
                ls = sorted(ls, key=lambda x:x[1]) # sort by time
                ls = [(t[0], t[2]=='base-recording-post-insert') for t in ls] # keep track of when talkens are flattened (change in the ground truth)
                _print('text snaps')
                _print(ls)
                return ls
            def numTempPauses(s):
                return s.count(u'\u2666')
            def numPeriods(s):
                return s.count('.')
            def numOtherPunctuation(s):
                return len(re.findall('[,-\/#!?$%\^&\*;:\{\}=\-_`~\'()]', s))

            text_snapshots = getTextSnapshots()

            prev_set = False
            prev = [0, 0, 0] # [num of pauses, num of periods, num of other punctuation]
            delta_deleted = [0, 0, 0]
            t_deleted = [0, 0, 0]
            for i in xrange(len(text_snapshots)-1):
                snapobj = text_snapshots[i]
                txt = snapobj[0]
                if snapobj[1]:
                    prev = [numTempPauses(txt), numPeriods(txt), numOtherPunctuation(txt)]
                    t_deleted = [(delta_deleted[k]+t_deleted[k]) for k in xrange(len(delta_deleted))] # add this to the total
                    delta_deleted = [0, 0, 0]
                    prev_set = True
                else:
                    curr = [numTempPauses(txt), numPeriods(txt), numOtherPunctuation(txt)]
                    _print("prev: " + str(prev))
                    _print("curr: " + str(curr))
                    if prev_set is False:
                        prev = curr
                        prev_set = True
                        continue
                    else:
                        delta_deleted = [-(curr[k]-prev[k]) for k in xrange(len(prev))] # calculate how many pauses were removed between snapshots
                        _print("delta: " + str(delta_deleted))

            t_deleted = [(delta_deleted[k]+t_deleted[k]) for k in xrange(len(delta_deleted))] # add final delta to total, if any

            _print("Deleted pauses: " + str(t_deleted))

            return t_deleted[0] # just return # of deleted temporary pauses, for now

            # return pause_op_totals[2] # total num of DEL pause ops
        def getTotalDeletedNonpauses():
            return txt_op_totals[2] # total num of DEL talkens over all snapshots
        def getTimeTotalDeletedPauses():
            pass # this is just not feasible, nor does it make much sense for NS (see our discussion about difference in rendered audio pause length)

        map_measurename_to_logtype = {
            'n_total_pauses': getCumulativeBasePauses, #override
            'n_total_nonpauses': getCumulativeBaseNonpauses, #override
            'n_total_tokens': None, #override
            't_total_pauses': getTotalBasePauseLength, #override
            'n_deleted_pauses': getTotalDeletedPauses, #override
            'n_deleted_nonpauses': getTotalDeletedNonpauses, #override
            'n_deleted_tokens': None, #override
            't_total_deleted_pauses': getTimeTotalDeletedPauses, #override
            'n_copy': 'copy', #override
            'n_cut': 'cut', #override
            'n_paste': 'paste', #override
        }

        for measurename in map_measurename_to_logtype:
            v = map_measurename_to_logtype[measurename]
            if isinstance(v, basestring): #when it's a string
                rtn[measurename] = sum([1 for datum in self.data if datum['type'] == map_measurename_to_logtype[measurename]])
            elif hasattr(v, '__call__'): #when it's a function
                rtn[measurename] = v()
            else:
                pass # otherwise it's None

        rtn['n_total_tokens'] = rtn['n_total_nonpauses'] + rtn['n_total_pauses']
        rtn['n_deleted_tokens'] = rtn['n_deleted_nonpauses'] + rtn['n_deleted_pauses']

        return rtn

# from https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance
def levenshtein(s1, s2):
    if len(s1) < len(s2):
        return levenshtein(s2, s1)

    # len(s1) >= len(s2)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1 # j+1 instead of j since previous_row and current_row are one character longer
            deletions = current_row[j] + 1       # than s2
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]

if __name__ == '__main__':
    try:
        configFile = ConfigFile(CONFIG_FILE_PATH)
        Utils.path_transcription = configFile.get('transcriptionpath')
        all = All(configFile.get('logpath'), configFile.get('pattern'))
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
