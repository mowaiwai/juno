import {Platform} from 'react-native';

export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface VoiceRecognitionError {
  code: string;
  message: string;
}

export type VoiceRecognitionCallback = (
  result: VoiceRecognitionResult | null,
  error: VoiceRecognitionError | null
) => void;

export type VoiceStatusCallback = (status: 'ready' | 'recording' | 'processing' | 'stopped') => void;

export interface VoiceServiceConfig {
  provider: 'iflytek' | 'baidu';
  appId: string;
  apiKey?: string;
  secretKey?: string;
  language?: 'zh-CN' | 'en-US';
  sampleRate?: number;
}

class VoiceRecognitionService {
  private config: VoiceServiceConfig | null = null;
  private isRecording: boolean = false;
  private statusCallback: VoiceStatusCallback | null = null;
  private recognitionCallback: VoiceRecognitionCallback | null = null;

  async initialize(config: VoiceServiceConfig): Promise<boolean> {
    this.config = config;
    console.log(`[VoiceService] Initialized with ${config.provider} provider`);
    return true;
  }

  setStatusCallback(callback: VoiceStatusCallback): void {
    this.statusCallback = callback;
  }

  setRecognitionCallback(callback: VoiceRecognitionCallback): void {
    this.recognitionCallback = callback;
  }

  async startRecording(): Promise<boolean> {
    if (this.isRecording) {
      console.warn('[VoiceService] Already recording');
      return false;
    }

    if (!this.config) {
      console.error('[VoiceService] Not initialized');
      this.recognitionCallback?.(null, {
        code: 'NOT_INITIALIZED',
        message: '语音服务未初始化',
      });
      return false;
    }

    try {
      this.isRecording = true;
      this.statusCallback?.('recording');
      console.log('[VoiceService] Recording started');

      this.simulateRecording();

      return true;
    } catch (error) {
      console.error('[VoiceService] Failed to start recording:', error);
      this.isRecording = false;
      this.recognitionCallback?.(null, {
        code: 'START_FAILED',
        message: '启动录音失败',
      });
      return false;
    }
  }

  async stopRecording(): Promise<VoiceRecognitionResult | null> {
    if (!this.isRecording) {
      console.warn('[VoiceService] Not recording');
      return null;
    }

    try {
      this.isRecording = false;
      this.statusCallback?.('processing');
      console.log('[VoiceService] Recording stopped, processing...');

      return new Promise((resolve) => {
        setTimeout(() => {
          this.statusCallback?.('stopped');
          const result: VoiceRecognitionResult = {
            text: '',
            confidence: 0.95,
            isFinal: true,
          };
          this.recognitionCallback?.(result, null);
          resolve(result);
        }, 500);
      });
    } catch (error) {
      console.error('[VoiceService] Failed to stop recording:', error);
      this.recognitionCallback?.(null, {
        code: 'STOP_FAILED',
        message: '停止录音失败',
      });
      return null;
    }
  }

  async cancelRecording(): Promise<void> {
    this.isRecording = false;
    this.statusCallback?.('ready');
    console.log('[VoiceService] Recording cancelled');
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  private simulateRecording(): void {
    let interimText = '';
    const phrases = [
      '我想添加一个联系人，',
      '名字是张明，',
      '他是我的大学同学，',
      '我们是在图书馆认识的',
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (!this.isRecording || index >= phrases.length) {
        clearInterval(interval);
        return;
      }

      interimText += phrases[index];
      this.recognitionCallback?.(
        {
          text: interimText,
          confidence: 0.9,
          isFinal: false,
        },
        null
      );
      index++;
    }, 800);
  }

  async destroy(): Promise<void> {
    if (this.isRecording) {
      await this.cancelRecording();
    }
    this.config = null;
    this.statusCallback = null;
    this.recognitionCallback = null;
    console.log('[VoiceService] Destroyed');
  }
}

export const voiceService = new VoiceRecognitionService();

export async function initializeVoiceService(): Promise<boolean> {
  const config: VoiceServiceConfig = {
    provider: Platform.OS === 'ios' ? 'iflytek' : 'baidu',
    appId: process.env.VOICE_APP_ID || 'YOUR_APP_ID',
    apiKey: process.env.VOICE_API_KEY || 'YOUR_API_KEY',
    secretKey: process.env.VOICE_SECRET_KEY || 'YOUR_SECRET_KEY',
    language: 'zh-CN',
    sampleRate: 16000,
  };

  return voiceService.initialize(config);
}

export async function startVoiceRecognition(): Promise<boolean> {
  return voiceService.startRecording();
}

export async function stopVoiceRecognition(): Promise<VoiceRecognitionResult | null> {
  return voiceService.stopRecording();
}

export async function cancelVoiceRecognition(): Promise<void> {
  return voiceService.cancelRecording();
}

export function setVoiceStatusCallback(callback: VoiceStatusCallback): void {
  voiceService.setStatusCallback(callback);
}

export function setVoiceRecognitionCallback(callback: VoiceRecognitionCallback): void {
  voiceService.setRecognitionCallback(callback);
}

export function isVoiceRecording(): boolean {
  return voiceService.isCurrentlyRecording();
}

export async function cleanupVoiceService(): Promise<void> {
  return voiceService.destroy();
}

export const VOICE_SERVICE_NOTES = `
================================================================================
                        语音识别服务集成说明
================================================================================

本服务提供语音识别的基础架构，支持集成讯飞(iFlytek)和百度(Baidu)语音识别服务。

--------------------------------------------------------------------------------
1. 讯飞语音识别集成 (iFlytek)
--------------------------------------------------------------------------------
讯飞提供了react-native-iflytek SDK，集成步骤：

1) 安装SDK:
   npm install @react-native-community/voice --save

2) 配置讯飞账号:
   - 前往讯飞开放平台(https://console.xfyun.cn/)注册账号
   - 创建应用，获取APPID、APIKey、SecretKey
   - 在代码中配置这些凭证

3) 权限配置:
   iOS: 在Info.plist中添加:
   <key>NSMicrophoneUsageDescription</key>
   <string>需要使用麦克风进行语音输入</string>

   Android: 在AndroidManifest.xml中添加:
   <uses-permission android:name="android.permission.RECORD_AUDIO"/>

--------------------------------------------------------------------------------
2. 百度语音识别集成 (Baidu)
--------------------------------------------------------------------------------
百度语音服务同样可用，但需要:

1) 安装百度语音SDK或使用第三方封装库
2) 在百度AI开放平台(https://ai.baidu.com/)注册
3) 创建语音应用，获取API Key和Secret Key
4) 使用OAuth2.0获取access_token

--------------------------------------------------------------------------------
3. 推荐方案
--------------------------------------------------------------------------------
考虑到易用性和跨平台支持，推荐使用:

1) @react-native-community/voice - 支持多平台和多个语音提供商
2) react-native-voice - 较流行但更新较少

安装命令:
   npm install @react-native-voice/voice

--------------------------------------------------------------------------------
4. 当前实现
--------------------------------------------------------------------------------
当前实现为模拟版本，真正的语音识别需要:

1) 安装并配置具体的语音SDK
2) 替换simulateRecording()方法中的模拟逻辑
3) 实现真实的音频采集和识别调用

================================================================================
`;