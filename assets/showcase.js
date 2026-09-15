(() => {
  function bootShowcase() {
    if(document.getElementById('project-bar'))return;
    const bridge=window.__slurry.projects,format=globalThis.SlurryProject;
    const el=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;};
    const button=(text,fn,cls='')=>{const node=el('button',{type:'button',class:'project-button '+cls},text);node.onclick=fn;return node;};
    const bar=el('div',{id:'project-bar'}),label=el('label',{},'Character'),character=el('input',{id:'character-name',maxlength:'24','aria-label':'Character name',placeholder:'Player',autocomplete:'off'});
    try{character.value=format.name(localStorage.getItem('slurry-character')||'Player',24,'Player');}catch{character.value='Player';}
    bridge.setName(character.value);label.append(character);
    const context=el('span',{id:'project-context','aria-live':'polite'});
    bar.append(label,context,button('Save project',()=>open('save'),'primary'),button('Showcase',()=>open('gallery')));
    document.getElementById('status').before(bar);
    const dialog=el('dialog',{class:'showcase-dialog','aria-labelledby':'showcase-title'}),head=el('div',{class:'showcase-head'}),heading=el('h2',{id:'showcase-title'}),content=el('div',{class:'showcase-body'}),status=el('p',{class:'showcase-status',role:'status','aria-live':'polite'});
    head.append(heading,button('Close',()=>dialog.close()));dialog.append(head,content);document.body.append(dialog);
    let profile=null,remaining=4,parent=null,currentTitle='',resume=false,mode='',busy=false,generation=0,retrySave=null;
    window.addEventListener('slurry-clear',()=>{parent=null;currentTitle='';context.textContent='';retrySave=null;});
    const say=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error);};
    async function api(path,method='GET',data) {
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
      try {
        const response=await fetch('/api/showcase'+path,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:controller.signal});
        let result;try{result=await response.json();}catch{throw new Error('Showcase is unavailable. Your world is still here.');}
        if(!response.ok)throw new Error(result.error||'Request failed. Please try again.');return result;
      }catch(error){if(error.name==='AbortError')throw new Error('Connection timed out. Try again; a retried save only counts once.');throw error;}
      finally{clearTimeout(timer);}
    }
    function updateCharacter(){character.value=bridge.setName(character.value);try{localStorage.setItem('slurry-character',character.value);}catch{}retrySave=null;}
    character.addEventListener('change',updateCharacter);
    async function session(create=false){const data=await api('/session',create?'POST':'GET',create?{name:character.value}:undefined);profile=data.profile;remaining=data.remaining;return data;}
    async function ensureProfile(){await session(true);}
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    head.lastChild.onclick=()=>{if(!busy)dialog.close();};
    dialog.addEventListener('close',()=>{generation++;bridge.resume(resume);retrySave=null;});
    async function open(next) {
      if(busy)return;
      mode=next;updateCharacter();resume=bridge.pause();dialog.showModal();content.replaceChildren(status);heading.textContent=next==='save'?'Save to showcase':'Community showcase';say('Loading…');
      const gen=++generation;
      try{await session();if(gen!==generation)return;if(next==='save')showSave();else await gallery();}
      catch(error){if(gen===generation){say(error.message,true);content.append(button('Try again',async()=>{dialog.close();open(next);}));}}
    }
    function showSave() {
      const form=el('form',{id:'showcase-save-form'}),titleLabel=el('label',{},'Project name'),title=el('input',{required:'',maxlength:'48',placeholder:'My little world',autocomplete:'off'});
      title.value=currentTitle;titleLabel.append(title);
      const note=el('p',{},'Your world will be public. Anyone can load it, give it a thumbs-up, or fork it.');
      const quota=el('p',{},`${remaining} of 4 saves left today · resets at midnight UTC`);
      const submit=el('button',{type:'submit',class:'project-button primary'},'Save to showcase');submit.disabled=remaining===0;
      if(parent)form.append(el('p',{},'The original project will be credited.'));
      form.append(titleLabel,note,quota,submit);content.replaceChildren(form,status);say('');
      title.addEventListener('change',()=>{title.value=format.name(title.value,48,'Untitled world');retrySave=null;});
      form.onsubmit=async event=>{
        event.preventDefault();if(busy)return;busy=true;submit.disabled=true;say('Saving your world…');
        try {
          await ensureProfile();
          if(!retrySave)retrySave={requestId:crypto.randomUUID(),title:format.name(title.value,48,'Untitled world'),parent,snapshot:await bridge.capture()};
          const data=await api('/projects','POST',retrySave);remaining=data.remaining;currentTitle=data.project.title;parent=data.project.id;context.textContent='Saved · '+currentTitle;retrySave=null;
          say(`Saved. ${remaining} of 4 saves left today.`);quota.textContent=`${remaining} of 4 saves left today · resets at midnight UTC`;submit.textContent='Saved';
          form.append(button('Browse showcase',()=>{mode='gallery';heading.textContent='Community showcase';gallery();}));
        }catch(error){say(error.message,true);submit.disabled=false;}finally{busy=false;}
      };
    }
    async function load(project,fork) {
      if(busy)return;
      if(!window.confirm('Replace the current world with “'+project.title+'”? Save your current work first if you want to keep it.'))return;
      busy=true;say('Loading world…');
      try{
        const data=await api('/projects/'+project.id);if(!dialog.open)return;
        await bridge.restore(data.snapshot);
        parent=project.id;currentTitle=fork?format.name(project.title+' remix',48,'Remix'):project.title;
        if(fork)bridge.setName(character.value);else character.value=bridge.name;
        context.textContent=(fork?'Fork of · ':'Loaded · ')+project.title;resume=false;dialog.close();
      }catch(error){say(error.message,true);}finally{busy=false;}
    }
    function preview(canvas,encoded) {
      const c=canvas.getContext('2d');if(!c)return;
      try{
        const data=format.decode(encoded,Uint8Array,16000),img=c.createImageData(160,100);
        const colors=['#06070a','#5b93ff','#e0a13a','#b3aea4','#ff8a2e','#b9ec38','#ff3d70','#ff6a2a','#dbb86f','#7a7883','#cfd6e3','#8f6237','#6b5230','#e6edfb','#8ed1f7','#b6bfcc','#3ddc6a','#b59cc9','#5cff30','#bde63e','#8cac4c','#c99b4c','#e4d8a1','#ffffff'];colors[31]='#8a8f9c';
        for(let i=0;i<data.length;i++){const rgb=parseInt((colors[data[i]]||colors[0]).slice(1),16);img.data.set([rgb>>16,(rgb>>8)&255,rgb&255,255],i*4);}c.putImageData(img,0,0);
      }catch{c.fillStyle='#0b0c10';c.fillRect(0,0,160,100);}
    }
    async function gallery() {
      const controls=el('div',{class:'showcase-controls'}),sort=el('select',{'aria-label':'Sort projects'}),grid=el('div',{class:'showcase-grid'}),more=button('Load more',()=>page(false));
      for(const [value,text]of [['new','Newest'],['top','Most liked']])sort.append(el('option',{value},text));
      controls.append(el('span',{},'Worlds made by players'),sort);content.replaceChildren(controls,status,grid,more);let offset=0,loading=false,gen=++generation;
      async function page(reset){
        if(loading)return;loading=true;sort.disabled=true;more.disabled=true;say('Loading projects…');
        if(reset){offset=0;grid.replaceChildren();}
        try{
          const data=await api('/projects?sort='+sort.value+'&offset='+offset);if(gen!==generation||!dialog.open)return;
          for(const project of data.projects){
            const card=el('article',{class:'project-card'}),canvas=el('canvas',{width:'160',height:'100','aria-label':project.title+' preview',role:'img'}),body=el('div',{class:'project-card-body'}),actions=el('div',{class:'project-card-actions'});
            preview(canvas,project.preview);body.append(el('h3',{},project.title),el('p',{},project.character+' · '+project.particles.toLocaleString()+' particles'));
            if(project.parent)body.append(button('↳ Original',async()=>{try{const data=await api('/projects/'+project.parent);await load(data.project,false);}catch(error){say(error.message,true);}}));
            const like=button('👍 '+project.likes,async()=>{
              if(busy)return;busy=true;like.disabled=true;
              try{await ensureProfile();const data=await api('/projects/'+project.id+'/like','POST',{liked:!project.liked});project.liked=data.liked;like.textContent='👍 '+data.likes;like.setAttribute('aria-pressed',String(data.liked));say('');}
              catch(error){say(error.message,true);}finally{busy=false;like.disabled=false;}
            });
            like.setAttribute('aria-label','Thumbs up '+project.title);like.setAttribute('aria-pressed',String(!!project.liked));like.disabled=!!project.own;
            actions.append(like,button('Load',()=>load(project,false)),button('Fork',()=>load(project,true)));body.append(actions);card.append(canvas,body);grid.append(card);
          }
          offset=data.nextOffset;more.hidden=offset===null;say('');if(!grid.children.length)grid.append(el('p',{class:'showcase-empty'},'No projects yet. Save the first world.'));
        }catch(error){say(error.message,true);more.hidden=false;more.textContent='Try again';}finally{loading=false;sort.disabled=false;more.disabled=false;}
      }
      sort.onchange=()=>page(true);await page(true);
    }
  }
  if(window.__slurry?.projects)bootShowcase();else window.addEventListener('slurry-ready',bootShowcase,{once:true});
})();
