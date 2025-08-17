import java.util.*; 
class Solution {
    public int solve(int[] arg1) {
        // Your logic here
        int max = Integer.MIN_VALUE;

        for(int num : arg1){

            max = Math.max(num , max);
        }

        System.out.println(max);

        return max;
    }
}