'use strict';
if(!window.JieCommunity.installed.includes('desktop-life')){if(window.JieLifeAnimation)window.JieLifeAnimation.load=()=>{};document.body.classList.add('community-no-desktop-life');}
if(!window.JieCommunity.installed.includes('speech'))document.body.classList.add('community-no-speech');
if(!window.JieCommunity.installed.includes('assistant'))document.body.classList.add('community-no-assistant');
