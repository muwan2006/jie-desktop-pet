'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('capture',{state:()=>ipcRenderer.invoke('capture-state'),accept:rect=>ipcRenderer.invoke('capture-accept',rect),cancel:()=>ipcRenderer.invoke('capture-cancel')});
