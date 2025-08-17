import java.util.*; 
class Solution {
    public int solve(int[] nums) {
        // Your logic here
        int max = Integer.MAX_VALUE;
        for(int num : nums) max = Math.max(max , num);

        return max;
    }
}