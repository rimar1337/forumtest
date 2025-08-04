import { Link } from "@tanstack/react-router";
import Login from "./Login";
import { SearchBox } from "./Search";



export default function Header(){


  return <div className="flex flex-row h-10 items-center px-2 sticky top-0 bg-gray-700 z-50">
    <Link to="/"><span className=" text-gray-50 font-bold">ForumTest</span></Link>
    {/* <div className="spacer flex-1" /> */}
    <SearchBox />
    <Login compact />
  </div>
}