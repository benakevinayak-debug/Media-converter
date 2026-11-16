package com.vinayakbenake.mediaconvert.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String PAGE = ORIGIN + "/assets/www/index.html";
    static final long INPUT_LIMIT = 100L * 1024 * 1024;
    static final long OUTPUT_LIMIT = 256L * 1024 * 1024;
    static final int PICK_FILES=10, PICK_TREE=11, PICK_OUTPUT=12;
    WebView browser;
    private volatile boolean destroyed=false, converting=false;
    private String pendingRequest;
    private final ArrayList<Uri> pendingFiles=new ArrayList<>();
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Map<String,Entry> entries=new ConcurrentHashMap<>();
    private final Map<String,Write> writes=new ConcurrentHashMap<>();
    private final Set<String> formats=new HashSet<>(java.util.Arrays.asList("mp4","mov","mkv","webm","avi","gif","mp3","wav","flac","aac","m4a","ogg","opus"));
    private final Set<String> media=new HashSet<>(java.util.Arrays.asList("mp4","mov","mkv","webm","avi","gif","mp3","wav","flac","aac","m4a","ogg","opus","wmv","flv","ts","3gp","wma","aiff","aif","hevc","m2ts","mts","mpeg","mpg","m4v","mka","oga","vob"));
    static class Entry { Uri input,parent,output; String name,folder,mime; long size; }
    static class Write { Uri uri; OutputStream stream; String entryId,name; long bytes; }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame=new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(255,248,245));
        frame.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        browser=new WebView(this);
        frame.addView(browser,new FrameLayout.LayoutParams(-1,-1));setContentView(frame);
        browser.getSettings().setJavaScriptEnabled(true);
        browser.getSettings().setDomStorageEnabled(true);
        browser.getSettings().setAllowFileAccess(false);
        browser.getSettings().setAllowContentAccess(false);
        browser.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.getSettings().setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets=new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/media/",this::readSelected).build();
        browser.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if(!"https".equals(uri.getScheme())||!"appassets.androidplatform.net".equals(uri.getHost())||!"GET".equals(request.getMethod()))return errorResponse(403,"Blocked");
                WebResourceResponse result=assets.shouldInterceptRequest(uri);
                return result==null?errorResponse(404,"Not found"):result;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !PAGE.equals(request.getUrl().toString());}
        });
        browser.addJavascriptInterface(new Bridge(),"Native");
        browser.loadUrl(PAGE);
        if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
    }
    static WebResourceResponse errorResponse(int code,String message){return new WebResourceResponse("text/plain","UTF-8",code,message,new HashMap<>(),new ByteArrayInputStream(message.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
    private WebResourceResponse readSelected(String id){
        Entry entry=entries.get(id);
        if(entry==null)return errorResponse(404,"Select the file again");
        try{
            InputStream input=getContentResolver().openInputStream(entry.input);
            if(input==null)throw new IOException("Unable to open file");
            InputStream limited=new FilterInputStream(input){
                long total;
                private void count(int n)throws IOException{if(n>0){total+=n;if(total>INPUT_LIMIT)throw new IOException("Android input limit is 100 MB");}}
                @Override public int read()throws IOException{int n=in.read();count(n<0?0:1);return n;}
                @Override public int read(byte[] b,int offset,int length)throws IOException{int n=in.read(b,offset,length);count(n);return n;}
            };
            return new WebResourceResponse("application/octet-stream",null,limited);
        }catch(Exception e){return errorResponse(403,"Unable to read selected file");}
    }
    private String extension(String name){int dot=name.lastIndexOf('.');return dot<0?"":name.substring(dot+1).toLowerCase(Locale.ROOT);}
    private Entry describe(Uri uri,Uri parent,String folder)throws Exception{
        Entry entry=new Entry();entry.input=uri;entry.parent=parent;entry.folder=folder;
        try(Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){
            if(c==null||!c.moveToFirst())throw new IOException("Could not read selected document");
            entry.name=c.getString(0);entry.size=c.isNull(1)?0:c.getLong(1);
        }
        entry.mime=getContentResolver().getType(uri);return entry;
    }
    private void addEntry(Entry entry,JSONArray files,JSONArray warnings)throws Exception{
        if(entry.name==null||!media.contains(extension(entry.name)))return;
        if(entry.size>INPUT_LIMIT){warnings.put(entry.name+": Android test version supports files up to 100 MB.");return;}
        for(Map.Entry<String,Entry> known:entries.entrySet())if(known.getValue().input.equals(entry.input)&&known.getValue().parent.equals(entry.parent)){files.put(descriptor(known.getKey(),entry));return;}
        String id=UUID.randomUUID().toString();entries.put(id,entry);files.put(descriptor(id,entry));
    }
    private JSONObject descriptor(String id,Entry entry)throws Exception{
        return new JSONObject().put("id",id).put("name",entry.name).put("size",entry.size).put("folder",entry.folder).put("type",entry.mime==null?"application/octet-stream":entry.mime);
    }
    private String displayName(Uri uri)throws Exception{
        try(Cursor c=getContentResolver().query(uri,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
            if(c==null||!c.moveToFirst())throw new IOException("Could not read folder name");return c.getString(0);
        }
    }
    private void requireWritable(Uri uri)throws Exception{
        try(Cursor c=getContentResolver().query(uri,new String[]{DocumentsContract.Document.COLUMN_FLAGS},null,null,null)){
            if(c==null||!c.moveToFirst()||(c.getLong(0)&DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE)==0)throw new IOException("Choose a folder where Android allows creating files.");
        }
    }
    private void collect(Uri tree,Uri directory,String folder,JSONArray files,JSONArray warnings,Set<String> visited,int depth)throws Exception{
        if(depth>32||files.length()>=1000)return;
        String id=DocumentsContract.getDocumentId(directory);if(!visited.add(id))return;
        Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,id);
        try(Cursor c=getContentResolver().query(children,new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
            if(c==null)throw new IOException("Could not read folder contents");
            while(c.moveToNext()&&files.length()<1000){
                Uri child=DocumentsContract.buildDocumentUriUsingTree(tree,c.getString(0));
                try{
                    if(DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(1)))collect(tree,child,folder+"/"+c.getString(2),files,warnings,visited,depth+1);
                    else addEntry(describe(child,directory,folder),files,warnings);
                }catch(Exception e){warnings.put(c.getString(2)+": "+e.getMessage());}
            }
        }
    }
    private void persist(Uri uri,int flags){try{getContentResolver().takePersistableUriPermission(uri,flags&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION));}catch(SecurityException ignored){}}
    private void openTree(int request){
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(intent,request);
    }
    private void callback(String id,JSONObject result,String error){
        runOnUiThread(()->{if(!destroyed)browser.evaluateJavascript("window.__androidResult("+JSONObject.quote(id)+","+JSONObject.quote(result==null?"{}":result.toString())+","+(error==null?"null":JSONObject.quote(error))+")",null);});
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=PICK_FILES&&request!=PICK_TREE&&request!=PICK_OUTPUT)return;
        if(pendingRequest==null)return;
        if(result!=RESULT_OK||data==null){
            String id=pendingRequest;pendingRequest=null;pendingFiles.clear();
            callback(id,canceled(),null);return;
        }
        if(request==PICK_FILES){
            pendingFiles.clear();
            if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)pendingFiles.add(data.getClipData().getItemAt(i).getUri());
            else if(data.getData()!=null)pendingFiles.add(data.getData());
            for(Uri uri:pendingFiles)persist(uri,data.getFlags());
            Toast.makeText(this,"Now choose the folder for converted files",Toast.LENGTH_LONG).show();
            openTree(PICK_OUTPUT);return;
        }
        Uri tree=data.getData();String id=pendingRequest;pendingRequest=null;
        ArrayList<Uri> selected=new ArrayList<>(pendingFiles);pendingFiles.clear();
        if(tree==null){callback(id,null,"No folder selected");return;}
        persist(tree,data.getFlags());
        io.execute(()->{
            try{
                Uri directory=DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));
                requireWritable(directory);String folder=displayName(directory);
                JSONArray files=new JSONArray(),warnings=new JSONArray();
                if(request==PICK_TREE)collect(tree,directory,folder,files,warnings,new HashSet<>(),0);
                else for(Uri input:selected)addEntry(describe(input,directory,folder),files,warnings);
                if(files.length()>=1000)warnings.put("Import limited to 1000 media files per selection.");
                callback(id,new JSONObject().put("files",files).put("warnings",warnings),null);
            }catch(Exception e){callback(id,null,e.getMessage());}
        });
    }
    private JSONObject canceled(){try{return new JSONObject().put("files",new JSONArray()).put("warnings",new JSONArray()).put("canceled",true);}catch(Exception e){throw new IllegalStateException(e);}}
    private String mime(String ext){
        switch(ext){case"mp3":return"audio/mpeg";case"wav":return"audio/wav";case"flac":return"audio/flac";case"aac":return"audio/aac";case"m4a":return"audio/mp4";case"ogg":return"audio/ogg";case"opus":return"audio/ogg";case"gif":return"image/gif";case"mov":return"video/quicktime";case"mkv":return"video/x-matroska";case"avi":return"video/x-msvideo";case"webm":return"video/webm";default:return"video/mp4";}
    }
    private Set<String> existingNames(Uri parent)throws Exception{
        Set<String> names=new HashSet<>();
        Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(parent,DocumentsContract.getDocumentId(parent));
        try(Cursor c=getContentResolver().query(children,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
            if(c==null)throw new IOException("Could not inspect the output folder");
            while(c.moveToNext())names.add(c.getString(0).toLowerCase(Locale.ROOT));
        }return names;
    }
    interface Operation { Object run()throws Exception; }
    private String response(Operation operation){
        try{return new JSONObject().put("ok",true).put("value",operation.run()).toString();}
        catch(Exception e){try{return new JSONObject().put("ok",false).put("error",e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()).toString();}catch(Exception ignored){return"{\"ok\":false,\"error\":\"Android storage error\"}";}}
    }
    private void abort(String token){
        Write write=writes.remove(token);if(write==null)return;
        try{write.stream.close();}catch(Exception ignored){}
        try{DocumentsContract.deleteDocument(getContentResolver(),write.uri);}catch(Exception ignored){}
    }
    public class Bridge {
        @JavascriptInterface public String info(){return "{\"version\":\"1.2.0 Android test\",\"creator\":\"Vinayak Benake\",\"platform\":\"android\"}";}
        @JavascriptInterface public void choose(String id,boolean folder){
            if(!id.matches("[0-9]{1,10}"))return;
            runOnUiThread(()->{
                if(pendingRequest!=null){callback(id,null,"Finish the current file selection first.");return;}
                pendingRequest=id;
                try{
                    if(folder)openTree(PICK_TREE);
                    else{
                        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                        intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"video/*","audio/*","image/gif","application/octet-stream"});
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                        startActivityForResult(intent,PICK_FILES);
                    }
                }catch(Exception e){pendingRequest=null;callback(id,null,e.getMessage());}
            });
        }
        @JavascriptInterface public String beginSave(String id,String ext){return response(()->{
            Entry entry=entries.get(id);if(entry==null||!formats.contains(ext))throw new IOException("Invalid output request");
            requireWritable(entry.parent);Set<String> names=existingNames(entry.parent);
            String base=entry.name.replaceFirst("\\.[^.]+$","")+"-converted";String name=base+"."+ext;
            int number=1;while(names.contains(name.toLowerCase(Locale.ROOT)))name=base+" ("+(number++)+")."+ext;
            Uri output=DocumentsContract.createDocument(getContentResolver(),entry.parent,mime(ext),name);
            if(output==null)throw new IOException("Android could not create the output file");
            if(output.equals(entry.input)){throw new IOException("The document provider did not create a new file");}
            Write write=new Write();write.uri=output;write.entryId=id;write.name=name;
            try{write.stream=getContentResolver().openOutputStream(output,"w");if(write.stream==null)throw new IOException("Could not open output file");}
            catch(Exception e){DocumentsContract.deleteDocument(getContentResolver(),output);throw e;}
            String token=UUID.randomUUID().toString();writes.put(token,write);return token;
        });}
        @JavascriptInterface public String appendSave(String token,String encoded){return response(()->{
            Write write=writes.get(token);if(write==null)throw new IOException("Output session expired");
            if(encoded.length()>300000)throw new IOException("Output chunk is too large");
            byte[] bytes=Base64.decode(encoded,Base64.NO_WRAP);write.bytes+=bytes.length;
            if(write.bytes>OUTPUT_LIMIT)throw new IOException("Android test version supports outputs up to 256 MB");
            write.stream.write(bytes);return true;
        });}
        @JavascriptInterface public String finishSave(String token){return response(()->{
            Write write=writes.get(token);if(write==null)throw new IOException("Output session expired");
            write.stream.close();Entry entry=entries.get(write.entryId);entry.output=write.uri;writes.remove(token);
            return entry.folder+"/"+displayName(write.uri);
        });}
        @JavascriptInterface public void abortSave(String token){abort(token);}
        @JavascriptInterface public String reveal(String id){return response(()->{
            Entry entry=entries.get(id);if(entry==null||entry.output==null)throw new IOException("No saved output");
            runOnUiThread(()->{
                try{Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(entry.output,getContentResolver().getType(entry.output)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(intent,"Open converted file"));}
                catch(Exception e){Toast.makeText(MainActivity.this,"No installed app can open this format",Toast.LENGTH_LONG).show();}
            });return true;
        });}
        @JavascriptInterface public void setConverting(boolean running){
            converting=running;runOnUiThread(()->{if(running)getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);});
        }
    }
    private void handleBack(){
        browser.evaluateJavascript("(()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true}return false})()",value->{
            if("true".equals(value))return;
            if(converting)new AlertDialog.Builder(this).setTitle("Conversion is running").setMessage("Leaving stops conversion. Keep the app open until it finishes.").setNegativeButton("Keep converting",null).setPositiveButton("Leave",(dialog,which)->finish()).show();
            else finish();
        });
    }
    @Override public void onBackPressed(){handleBack();}
    @Override protected void onDestroy(){
        destroyed=true;for(String token:new ArrayList<>(writes.keySet()))abort(token);io.shutdownNow();
        if(browser!=null){browser.removeJavascriptInterface("Native");browser.destroy();}super.onDestroy();
    }
}
