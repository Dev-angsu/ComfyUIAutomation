import argparse
from pipeline import run_pipeline, run_dynamic_pipeline

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run ComfyUI Automated Image Generation Pipeline")
    parser.add_argument("--mode", type=str, choices=["jobs", "dynamic"], default="jobs", 
                        help="Select 'jobs' to run from a file, or 'dynamic' for randomized template prompts")
    parser.add_argument("--jobs", type=str, default="jobs.json", help="Path to the jobs JSON or CSV file (for 'jobs' mode)")
    parser.add_argument("--dict", type=str, default="dictionaries.json", help="Path to the dynamic dictionary JSON file (for 'dynamic' mode)")
    parser.add_argument("--count", type=int, default=1, help="Number of images to generate (for 'dynamic' mode)")
    args = parser.parse_args()
    
    try:
        if args.mode == "jobs":
            run_pipeline(args.jobs)
        elif args.mode == "dynamic":
            run_dynamic_pipeline(args.count, args.dict)
    except Exception as e:
        print(f"Pipeline failed: {e}")