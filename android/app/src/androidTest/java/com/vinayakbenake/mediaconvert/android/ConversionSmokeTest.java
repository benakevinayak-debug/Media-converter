package com.vinayakbenake.mediaconvert.android;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class ConversionSmokeTest {
    private String evaluate(ActivityScenario<MainActivity> scenario,String script)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        scenario.onActivity(activity->activity.browser.evaluateJavascript(script,result->{value.set(result);latch.countDown();}));
        assertTrue("WebView evaluation timed out",latch.await(15,TimeUnit.SECONDS));return value.get();
    }
    @Test public void offlineEngineConvertsAudioInsideAndroidWebView()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            boolean loaded=false;
            for(int i=0;i<120;i++){
                if("true".equals(evaluate(scenario,"typeof loadEngine==='function' && typeof Native!=='undefined' && document.querySelectorAll('#fmts button').length===13"))){loaded=true;break;}
                Thread.sleep(500);
            }
            assertTrue("Bundled Android interface did not load",loaded);
            assertEquals("true",evaluate(scenario,"document.body.textContent.includes('Vinayak Benake') && JSON.parse(Native.info()).platform==='android'"));
            evaluate(scenario,"window.__androidSmoke='running'; (async()=>{try{await loadEngine();const code=await ffmpeg.exec(['-f','lavfi','-i','sine=frequency=440:duration=1','-c:a','pcm_s16le','android-smoke.wav']);if(code!==0)throw new Error('WAV creation failed');const data=await run('android-smoke.wav','android-smoke.mp3',args('mp3','medium'));if(!data||data.length<2000)throw new Error('MP3 conversion failed');window.__androidSmoke='ok'}catch(error){window.__androidSmoke='failed: '+error.message}})(); true");
            String status="";
            for(int i=0;i<360;i++){
                status=evaluate(scenario,"window.__androidSmoke");
                if("\"ok\"".equals(status))return;
                if(status!=null&&status.contains("failed:"))break;
                Thread.sleep(500);
            }
            fail("Android FFmpeg smoke test: "+status+"; "+evaluate(scenario,"JSON.stringify(logBuf.slice(-8))"));
        }
    }
}
