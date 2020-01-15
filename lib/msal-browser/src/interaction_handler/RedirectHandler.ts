/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { IInteractionHandler } from "./IInteractionHandler";
import { BrowserAuthError } from "../error/BrowserAuthError";
import { StringUtils, AuthorizationCodeModule, TemporaryCacheKeys, AuthenticationParameters, AuthError, TokenResponse, Constants } from "msal-common";
import { AuthCallback } from "../app/PublicClientApplication";
import { BrowserConfigurationAuthError } from "../error/BrowserConfigurationAuthError";
import { BrowserStorage } from "../cache/BrowserStorage";
import { BrowserConstants } from "../utils/BrowserConstants";

export class RedirectHandler extends IInteractionHandler {

    private authCallback: AuthCallback;

    constructor(authCodeModule: AuthorizationCodeModule, storageImpl: BrowserStorage,  redirectCallback: AuthCallback) {
        super(authCodeModule, storageImpl);
        if (!redirectCallback) {
            throw BrowserConfigurationAuthError.createRedirectCallbacksNotSetError();
        }
        this.authCallback = redirectCallback;
    }

    /**
     * Redirects window to given URL.
     * @param urlNavigate 
     */
    showUI(authRequest: AuthenticationParameters): void {
        this.browserStorage.setItem(TemporaryCacheKeys.ORIGIN_URI, window.location.href);
        this.authModule.createLoginUrl(authRequest).then((urlNavigate) => {
            this.browserStorage.setItem(BrowserConstants.INTERACTION_STATUS_KEY, BrowserConstants.INTERACTION_IN_PROGRESS);
            // Navigate if valid URL
            if (urlNavigate && !StringUtils.isEmpty(urlNavigate)) {
                this.authModule.logger.infoPii("Navigate to:" + urlNavigate);
                window.location.assign(urlNavigate);
            } else {
                this.authModule.logger.info("Navigate url is empty");
                throw BrowserAuthError.createEmptyRedirectUriError();
            }
        });
    }

    /**
     * Handle authorization code response in the window.
     * @param hash 
     */
    async handleCodeResponse(locationHash: string, navigateToLoginRequestUrl?: boolean): Promise<void> {
        if (StringUtils.isEmpty(locationHash)) {
            throw BrowserAuthError.createEmptyHashError(locationHash);
        }

        if (navigateToLoginRequestUrl) {
            this.browserStorage.setItem(TemporaryCacheKeys.URL_HASH, locationHash);
            if (window.parent === window) {
                const loginRequestUrl = this.browserStorage.getItem(TemporaryCacheKeys.ORIGIN_URI);

                // Redirect to home page if login request url is null (real null or the string null)
                if (!loginRequestUrl || loginRequestUrl === "null") {
                    this.authModule.logger.error("Unable to get valid login request url from cache, redirecting to home page");
                    window.location.href = "/";
                } else {
                    window.location.href = loginRequestUrl;
                }
            }
            return;
        } else {
            window.location.hash = "";
        }

        try {
            this.browserStorage.removeItem(BrowserConstants.INTERACTION_STATUS_KEY);
            const codeResponse = this.authModule.handleFragmentResponse(locationHash);
            const tokenResponse: TokenResponse = await this.authModule.acquireToken(null, codeResponse);
            this.authCallback(null, tokenResponse);
        } catch (err) {
            this.authCallback(err, null);
        }
    }
}