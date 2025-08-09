import { BrowserOAuthClient, type ClientMetadata } from '@atproto/oauth-client-browser';

// const domain = location.origin ? location.origin : ((import.meta?.env?.DEV) ? 'https://local3768forumtest.whey.party' : 'https://forumtest.whey.party')
const handleResolverPDS = 'https://pds-nd.whey.party'

// export const generateClientMetadata = (appOrigin: string) => {
//   const callbackPath = '/callback';

//   return {
//       "client_id": `${appOrigin}/client-metadata.json`,
//       "client_name": "ForumTest",
//       "client_uri": appOrigin,
//       "logo_uri": `${appOrigin}/logo192.png`,
//       "tos_uri": `${appOrigin}/terms-of-service`,
//       "policy_uri": `${appOrigin}/privacy-policy`,
//       "redirect_uris": [`${appOrigin}${callbackPath}`]  as [string, ...string[]],
//       "scope": "atproto transition:generic",
//       "grant_types": ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
//       "response_types": ["code"] as ["code"],
//       "token_endpoint_auth_method": "none" as "none",
//       "application_type": "web" as "web",
//       "dpop_bound_access_tokens": true
//     };
// }

// IF ERROR: you need to build it first, either npm run dev or npm run build
import clientMetadata from '../../public/client-metadata.json' assert { type: 'json' };

// async function loadClientMetadata(): Promise<ClientMetadata> {
//   const res = await fetch('/client-metadata.json');
//   if (!res.ok) throw new Error('Failed to load client metadata');
//   return res.json();
// }

export const oauthClient = new BrowserOAuthClient({
  clientMetadata: clientMetadata as ClientMetadata,
  handleResolver: handleResolverPDS,
});