//setup
const _ = require('lodash');
const colors = require('colors');
const Q = require('q');
const inquirer = require('inquirer');
const translate = require('google-translate-api');
const say = console.log;
const supportedLangs = require('./langs.js').supportedLangs;
const optionsNum = 3; //number of options at each step
const introText = 'Mutatext allows you to mutate text using google translate. Follow instructions below to try it out or learn more at http://mutatext.com.\nHappy Mutatexting!\n';
let transformHistory = [];
let opts = {};

//init
const init = () => {
  say(colors.rainbow('\nH*E*L*L*O*T*H*E*R*E!'));
  say(colors.green(introText));
  //TODO: validate input
  inquirer.prompt([
    {
      type: 'input',
      name: 'text',
      message: 'What text would you like to mutate (type in text in any language)?',
      default: 'To be or not to be - that is the question'
    },
    {
      type: 'input',
      name: 'numTrans',
      message: 'How many languages do you want to translate to before going back to the original language?',
      default: '4'
    },
    {
      type: 'confirm',
      name: 'showINterimSteps',
      message: 'Show interim steps?',
      default: false
    },
  ])
	.then((answers) => {
    opts.showInterimSteps = answers.showInterimSteps;
    translateOptions({answers, optionsNum});
	});
};

//showOptions
const showOptions = ({options, numTrans}) => {
  //build list of options that we can show
  if(opts.showInterimSteps) {
    console.log(options);
  }
  //console.log(transformHistory);
  let choices = _.map(options, (opt) => {
    //TODO: show transofmration history like this (en->ru->zh)
    const transformsLangs = _.map(opt, (transform) => {
      return getLangName(transform.lang);
    });
    return '[' + _.join(transformsLangs, '->') + '] ' + _.last(opt).text;
  });
  //add exit to choices
  choices.push(new inquirer.Separator());
  choices.push('EXIT');
  //show
  inquirer.prompt([
    {
      type: 'list',
      name: 'text',
      message: 'Which mutation would you like to continue with?',
      choices: choices
    }
  ])
	.then((answers) => {
    if(answers.text == 'EXIT') {
      say(colors.red('\nHere is the history of your mutations:\n'));
      say(colors.green(_.join(_.map(transformHistory, (historyItem) => {
        return historyItem.text;
      }), ' -> ')));
      say(colors.rainbow('\nThanks for using Mutatext! If you like it, please consider sharing with your friends.\n'));
      say(colors.rainbow('Bye!\n'));
      return;
    }
    answers.numTrans = numTrans;
    answers.text = _.last(answers.text.split(']')).trim();
    translateOptions({answers, optionsNum: options.length});
	});
};

//detectLanguage (async, thenable)
const detectLanguage = (text) => {
  let dfr = Q.defer();
  translate(text, {to: 'en'}).then(res => {
    dfr.resolve(res.from.language.iso);
  }).catch(err => {
    dfr.reject(err);
  });
  return dfr.promise;
};

//translateOptions
const translateOptions = ({answers, optionsNum}) => {
  //detect original language and add to history
  detectLanguage(answers.text)
  .then((res) => {
    //console.log('lang detected: '+res);
    transformHistory.push({
      text: answers.text,
      lang: res
    });
  });
  let options = [];
  for(let i=0; i<optionsNum; i++) {
    let dfr = Q.defer();
    fitr({
      step: 0, //current step
      numTrans: answers.numTrans, //number of transformations required
      textChain: [
        {
          text: answers.text
        }
      ]
    })
    .then(res => {
      dfr.resolve(res);
    });
    options[i] = dfr.promise;
  }
  Q.all(options)
    .then(() => {
      //so options are ready. now show them to the user
      showOptions({options:options, numTrans: answers.numTrans});
    });
};

//get random lang
const getRandomLang = (except) => {
  //TODO: exclude already used languages
  return _.sample(supportedLangs).code;
};

//get language name from code
const getLangName = (code) => {
  const lang = _.find(supportedLangs, ['code', code]);
  if(lang && lang.name) {
    return lang.name;
  } else {
    say(colors.red('Lang code not recognized, something went wrong'));
    return;
  }
};

//found in translation (recursive and promise-based)
const fitr = ({textChain, step, numTrans}) => {
  //first create a deferred
  let deferred = Q.defer();
  if(step == numTrans) { //if we have transformed text enough times - translate once back to the original language and then return
    //console.log(transformHistory);
    translate(_.last(textChain).text, {to: transformHistory[0].lang}).then(res => {
      textChain.push({
        text: res.text,
        lang: textChain[0].lang
      });
      deferred.resolve(textChain);
    });
  } else { //else -> translate one more time
    let toLang = getRandomLang();
    translate(_.last(textChain).text, {to: toLang}).then(res => {
      textChain[step].lang = res.from.language.iso;
      textChain.push({
        text: res.text,
        lang: toLang
      });
      step++;
      fitr({
        textChain,
        step,
        numTrans
      }).then(res => {
        deferred.resolve(textChain);
      });
    }).catch(err => {
      say(colors.red('ERROR!!!\n'));
      console.error(err);
      deferred.reject();
    });
  }
  //return promise
  return deferred.promise;
};

// off we go
init();
