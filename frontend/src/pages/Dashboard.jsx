import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [duration, setDuration] = useState(30);
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleCreateContest = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Creating contest...');
    try {
      const { data } = await API.post('/contest/create', { duration });
      toast.success(`Contest room created!`, { id: toastId });
      // Navigate to the new lobby page
      navigate(`/contest/${data.roomId}/lobby`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create contest', { id: toastId });
    }
  };
  
  const handleJoinContest = async (e) => {
    e.preventDefault();
    if (!roomId) {
        toast.error("Please enter a Room ID.");
        return;
    }
    const toastId = toast.loading('Joining contest...');
     try {
      await API.post('/contest/join', { roomId });
      toast.success(`Joined contest!`, { id: toastId });
      // Navigate to the new lobby page
      navigate(`/contest/${roomId}/lobby`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to join contest', { id: toastId });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {/* Create Contest */}
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Create a New Contest</h2>
        <form onSubmit={handleCreateContest}>
          <label className="block text-gray-300 mb-2">Contest Duration (minutes)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="10"
            max="180"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button type="submit" className="w-full mt-4 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-md transition duration-200">
            Create Room
          </button>
        </form>
      </div>

      {/* Join Contest */}
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Join an Existing Contest</h2>
        <form onSubmit={handleJoinContest}>
          <label className="block text-gray-300 mb-2">Enter Room Code</label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g., aBcDeF12"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button type="submit" className="w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-md transition duration-200">
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;