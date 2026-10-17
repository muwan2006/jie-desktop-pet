'use strict';
const path=require('node:path'),{endpoint}=require('./qq-transport.cjs');
const BACKENDS={napcat:{label:'NapCat',url:'ws://127.0.0.1:3001/',help:'https://napneko.github.io/guide/boot/Shell'},llbot:{label:'LLBot · 试用',url:'ws://127.0.0.1:3002/',help:'https://luckylillia.com/guide/config'}};
const kind=v=>Object.hasOwn(BACKENDS,v)?v:'napcat';
function profiles(v={}){return Object.fromEntries(Object.entries(BACKENDS).map(([k,d])=>[k,{url:endpoint(v?.[k]?.url||d.url)}]));}
function normalize(v={}){const bridgeKind=kind(v.bridgeKind),bridgeProfiles=profiles(v.bridgeProfiles),url=endpoint(v.url||bridgeProfiles[bridgeKind].url);bridgeProfiles[bridgeKind]={url};return {bridgeKind,bridgeProfiles,url};}
function transition(previous,input){const bridgeKind=kind(input.bridgeKind??previous.bridgeKind),bridgeProfiles=profiles(previous.bridgeProfiles);bridgeProfiles[kind(previous.bridgeKind)]={url:endpoint(previous.url)};return {...previous,...input,bridgeKind,bridgeProfiles,url:endpoint(input.url||(bridgeKind===kind(previous.bridgeKind)?previous.url:bridgeProfiles[bridgeKind].url))};}
function tokenFile(directory,v){return path.join(directory,kind(v)==='llbot'?'jie-qq-llbot.enc':'jie-qq-connection.enc');}
module.exports={BACKENDS,kind,profiles,normalize,transition,tokenFile};
