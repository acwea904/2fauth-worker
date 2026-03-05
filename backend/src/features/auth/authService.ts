import { EnvBindings, AppError } from '@/app/config';
import { generateSecureJWT } from '@/shared/utils/crypto';
import { getOAuthProvider } from '@/features/auth/providers/index';
import type { OAuthUserInfo } from '@/features/auth/providers/baseOAuthProvider';

export class AuthService {
    private env: EnvBindings;

    constructor(env: EnvBindings) {
        this.env = env;
    }

    /**
     * 生成提供商的授权重定向地址
     */
    async generateAuthorizeUrl(providerName: string): Promise<{ url: string, state: string, codeVerifier?: string }> {
        const provider = getOAuthProvider(providerName, this.env);
        const state = crypto.randomUUID();
        const result = await provider.getAuthorizeUrl(state);

        return {
            url: result.url,
            state: state,
            codeVerifier: result.codeVerifier
        };
    }

    /**
     * OAuth Callback 处理，生成会话并返回附加参数
     */
    async handleOAuthCallback(providerName: string, body: any): Promise<{ token: string, userInfo: OAuthUserInfo, deviceKey: string }> {
        const provider = getOAuthProvider(providerName, this.env);

        let params: string | URLSearchParams;
        if (providerName === 'telegram') {
            const searchParams = new URLSearchParams();
            Object.entries(body).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            });
            params = searchParams;
        } else {
            if (!body.code) throw new AppError('oauth_code_missing', 400);
            params = body.code;
        }

        const userInfo = await provider.handleCallback(params, body.codeVerifier);

        // 白名单检查
        this.verifyWhitelist(userInfo, provider.whitelistFields);

        // 签发 Token
        const token = await this.generateSystemToken(userInfo);

        // 附加客户端签名因子
        const deviceKey = await this.generateDeviceKey(userInfo.id);

        return { token, userInfo, deviceKey };
    }

    /**
     * 生成客户端绑定标识
     */
    private async generateDeviceKey(userId: string): Promise<string> {
        const secret = this.env.JWT_SECRET;
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(userId + "device_salt_offline_key"));
        return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 白名单校验
     */
    private verifyWhitelist(userInfo: OAuthUserInfo, whitelistFields: string[]) {
        // 如果 explicitly allowed all, 则放行
        const allowAllStr = String(this.env.OAUTH_ALLOW_ALL || '').toLowerCase();
        if (allowAllStr === 'true' || allowAllStr === '1') {
            return;
        }

        const allowedUsersStr = this.env.OAUTH_ALLOWED_USERS || '';
        const allowedIdentities = allowedUsersStr.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);

        // 如果配置了白名单，严格执行
        if (allowedIdentities.length > 0) {
            const userEmail = (userInfo.email || '').toLowerCase();
            const userName = (userInfo.username || '').toLowerCase();
            let isAllowed = false;

            if (whitelistFields.includes('email') && userEmail && allowedIdentities.includes(userEmail)) {
                isAllowed = true;
            }

            if (whitelistFields.includes('username') && userName && allowedIdentities.includes(userName)) {
                isAllowed = true;
            }

            if (!isAllowed) {
                throw new AppError('unauthorized_user', 403);
            }
        } else {
            // 默认安全策略：如果未配置白名单，未开启 ALLOW_ALL，则拒绝所有人（或者也可以记录警告，但为了安全通常应拒绝）
            throw new AppError('not_whitelisted', 403);
        }
    }

    /**
     * 生成系统内部 Token
     */
    private async generateSystemToken(userInfo: OAuthUserInfo): Promise<string> {
        const payload = {
            userInfo: {
                id: userInfo.id,
                username: userInfo.username,
                email: userInfo.email,
                avatar: userInfo.avatar,
                provider: userInfo.provider
            }
        };

        if (!this.env.JWT_SECRET) {
            throw new AppError('missing_jwt_secret', 500);
        }

        return await generateSecureJWT(payload, this.env.JWT_SECRET);
    }
}
