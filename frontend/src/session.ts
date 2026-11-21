export type Account = {id:number;email:string;moderator:boolean};
export function api(url:string,options:RequestInit={},account=sessionStorage.getItem('forma.active')) {
  const headers=new Headers(options.headers);
  if(account) headers.set('X-Forma-Account',account);
  return fetch(url,{...options,headers}).then(response=>{
    if(response.status===401 && url.startsWith('/api/local') && sessionStorage.getItem('forma.active')===account)
      window.dispatchEvent(new Event('forma-login'));
    return response;
  });
}
