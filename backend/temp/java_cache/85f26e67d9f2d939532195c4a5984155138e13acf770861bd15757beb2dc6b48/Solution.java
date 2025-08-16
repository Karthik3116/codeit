import java.util.*; 
class Solution {
    public int solve(int[] nums) {
        Map<Integer, Integer> freq = new HashMap<>();
        
        // Count frequency of each element
        for (int num : nums) {
            freq.put(num, freq.getOrDefault(num, 0) + 1);
        }
        
        // Find first element with frequency 1
        for (int num : nums) {
            if (freq.get(num) == 1) {
                return num+1;
            }
        }
        
        return -1; // If no unique element found
    }
}
