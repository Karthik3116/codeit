import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="text-center mt-20">
      
      <h1 className="text-5xl font-extrabold text-white mb-4">Welcome to CodeIt</h1>
      <p className="text-xl text-gray-400 mb-8">
        The ultimate platform for live coding contests with your friends.
      </p>
      <div>
        <Link
          to="/signup"
          className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-8 rounded-full text-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
};

export default Home;