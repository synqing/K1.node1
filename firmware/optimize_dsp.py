# PlatformIO build script for selective DSP optimization
# This script applies higher optimization levels to performance-critical audio/DSP files
# while keeping the rest of the codebase optimized for size

Import("env")

# Define DSP files that need performance optimization
dsp_files = [
    "src/audio/goertzel.cpp",
    "src/audio/tempo.cpp", 
    "src/audio/multi_scale_tempogram.cpp",
    "src/audio/microphone.cpp",
    "src/audio/vu.cpp",
    "src/audio/validation/tempo_validation.cpp",
    "src/beat_events.cpp"
]

# Build flags for DSP files - optimize for speed
dsp_flags = [
    "-O2",                    # Optimize for speed
    "-fno-tree-vectorize",    # Disable auto-vectorization (can hurt performance on ESP32)
    "-fno-strict-aliasing",   # Allow type punning in DSP code
    "-ffast-math",            # Fast math operations (careful with precision)
    "-funroll-loops"          # Unroll loops for better performance
]

# Build flags for general code - optimize for size  
general_flags = [
    "-Os",                    # Optimize for size
    "-fno-strict-aliasing",
    "-fdata-sections",        # Enable data garbage collection
    "-ffunction-sections"     # Enable function garbage collection
]

def optimize_dsp_files(node):
    """Apply performance optimization to DSP files"""
    file_path = str(node)
    
    # Check if this is a DSP file that needs performance optimization
    for dsp_file in dsp_files:
        if file_path.endswith(dsp_file) or file_path.endswith(dsp_file.replace("src/", "")):
            print(f"DSP Optimization: Applying -O2 to {file_path}")
            
            # Create a copy of the environment for this file
            optimized_env = env.Clone()
            
            # Remove general optimization flags
            optimized_env["CCFLAGS"] = [flag for flag in optimized_env["CCFLAGS"] if flag not in ["-Os", "-O0", "-O1", "-O2", "-O3"]]
            optimized_env["CXXFLAGS"] = [flag for flag in optimized_env["CXXFLAGS"] if flag not in ["-Os", "-O0", "-O1", "-O2", "-O3"]]
            
            # Add DSP-specific optimization flags
            optimized_env.Append(CCFLAGS=dsp_flags)
            optimized_env.Append(CXXFLAGS=dsp_flags)
            
            return optimized_env.Object(node)
    
    # Return original node for non-DSP files (uses general optimization)
    return node

# Register the optimization function
env.AddBuildMiddleware(optimize_dsp_files, "*.cpp")

print("DSP optimization script loaded - performance-critical audio files will use -O2 optimization")
