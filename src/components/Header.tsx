import { Link } from "@tanstack/react-router";
import Login from "./OAuthLogin";
import { SearchBox } from "./Search";
import { useCachedProfileJotai } from "@/esav/hooks";
import { useAuth } from "@/providers/OAuthProvider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";

export default function Header() {
  const { agent, status } = useAuth();
  const did = agent && agent.did && status === "signedIn" ? agent.did : null;
  const [profile, profileloading] = useCachedProfileJotai(did);

  const avatarUrl =
    profile?.profile.avatar?.ref.$link && profile?.pdsUrl
      ? `${profile.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${profile.did}&cid=${profile?.profile.avatar?.ref.$link}`
      : undefined;

  return (
    <div className=" flex flex-row h-10 items-center px-2 sticky top-0 bg-gray-700 z-50">
      <Link to="/">
        <span className=" text-gray-50 font-bold">ForumTest</span>
      </Link>
      {/* <div className="spacer flex-1" /> */}
      <SearchBox />

      {profile && !profileloading ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <img
                style={{ height: 28, width: 28, borderRadius: 9999 }}
                src={avatarUrl}
                alt={`Avatar for @${profile?.handle}`}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 mt-2 bg-gray-800 p-4 rounded-md" align="end">
              <DropdownMenuLabel className="font-semibold text-gray-50">
                @{profile.handle}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Login compact />
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <Login compact />
      )}
    </div>
  );
}
