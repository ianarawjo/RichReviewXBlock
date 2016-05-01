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
        self.config.set(CONFIG_SECTION, 'LogPath', '~/Dropbox/UIST16-Interviews/Pilot2')

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
        dirs = [dir for dir in os.listdir(path) if os.path.isdir(os.path.join(path, dir))]
        if len(dirs) == 0:
            self.sessions = self.loadByTime(path)

        else:
            self.sessions = self.loadByDir(path, dirs)

    def loadByTime(self, path):
        print path
        js_files = [item for item in os.listdir(path) if os.path.splitext(item)[1] == '.json']
        js_files.sort()
        return [Session(path, js) for js in js_files]

    def loadByDir(self, path, dirs):
        print path
        js_paths = [
            [(dir, file) for file in os.listdir(os.path.join(path, dir)) if os.path.splitext(file)[1] == '.json']
            for dir in dirs
            ]
        for js_path in js_paths:
            if len(js_path) != 1:
                raise Exception('NotSingleJsonSession', path, js_path)
        js_paths = [js_path[0] for js_path in js_paths]
        return [Session(os.path.join(path, js[0]), js[1]) for js in js_paths]

class Session(object):
    def __init__(self, dir_path, file_path):
        print '    ', dir_path, file_path
        with open(os.path.join(dir_path, file_path)) as f:
            self.data = simplejson.loads(f.read())
        self.preprocess()

    def preprocess(self):
        # preprocess before the analysis if needs be
        pass

    def getNumEdits(self):
        return 0

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