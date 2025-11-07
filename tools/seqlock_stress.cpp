// Seqlock stress helper: generates N read attempts and CSV snapshots.
// Build: g++ -O3 -std=c++17 -pthread tools/seqlock_stress.cpp -o seqlock_stress
// Run:   ./seqlock_stress --attempts 10000000 --readers 2 --bins 64 --writer-hz 200 --out stress.csv

#include <atomic>
#include <chrono>
#include <cstring>
#include <fstream>
#include <iostream>
#include <random>
#include <string>
#include <thread>
#include <vector>

struct Args {
  uint64_t attempts = 10'000'000ULL;
  int readers = 2;
  int bins = 64;
  double writer_hz = 200.0; // writer updates per second
  std::string out = "stress.csv";
};

static void parse_args(int argc, char** argv, Args& a) {
  for (int i=1;i<argc;++i) {
    std::string k = argv[i];
    auto next = [&](uint64_t def)->uint64_t{ if (i+1<argc) return std::stoull(argv[++i]); return def; };
    auto nexti = [&](int def)->int{ if (i+1<argc) return std::stoi(argv[++i]); return def; };
    auto nextd = [&](double def)->double{ if (i+1<argc) return std::stod(argv[++i]); return def; };
    auto nexts = [&](std::string def)->std::string{ if (i+1<argc) return std::string(argv[++i]); return def; };
    if (k == "--attempts") a.attempts = next(a.attempts);
    else if (k == "--readers") a.readers = nexti(a.readers);
    else if (k == "--bins") a.bins = nexti(a.bins);
    else if (k == "--writer-hz") a.writer_hz = nextd(a.writer_hz);
    else if (k == "--out") a.out = nexts(a.out);
  }
}

int main(int argc, char** argv) {
  Args args; parse_args(argc, argv, args);
  std::atomic<uint32_t> seq{0};
  std::vector<float> shared(args.bins, 0.f);
  std::atomic<bool> running{true};

  // Writer: updates bins with a simple pattern at writer_hz
  std::thread writer([&]{
    using namespace std::chrono;
    auto period = duration<double>(1.0/args.writer_hz);
    auto next = steady_clock::now();
    uint32_t tick=0;
    std::vector<float> local(args.bins);
    while (running.load(std::memory_order_relaxed)) {
      for (int i=0;i<args.bins;++i) local[i] = float(i + (tick & 0xF));
      seq.fetch_add(1, std::memory_order_acq_rel);
      std::memcpy(shared.data(), local.data(), args.bins*sizeof(float));
      seq.fetch_add(1, std::memory_order_acq_rel);
      tick++;
      next += period;
      std::this_thread::sleep_until(next);
    }
  });

  struct ReaderStats { uint64_t attempts=0, successes=0; };
  std::vector<ReaderStats> stats(args.readers);

  auto reader_fn = [&](int idx){
    std::vector<float> local(args.bins);
    uint64_t done=0, ok=0;
    while (true) {
      uint64_t a = ++stats[idx].attempts;
      uint32_t s1 = seq.load(std::memory_order_acquire);
      if (s1 & 1u) continue;
      std::memcpy(local.data(), shared.data(), args.bins*sizeof(float));
      uint32_t s2 = seq.load(std::memory_order_acquire);
      if (s1 == s2 && ((s2 & 1u) == 0)) { ++stats[idx].successes; ++ok; }
      ++done;
      if (ok + (done-ok) >= args.attempts/args.readers) break;
    }
  };

  std::vector<std::thread> readers;
  readers.reserve(args.readers);
  for (int i=0;i<args.readers;++i) readers.emplace_back(reader_fn, i);
  for (auto& t: readers) t.join();
  running.store(false);
  writer.join();

  uint64_t attempts=0, successes=0;
  for (auto& s: stats) { attempts += s.attempts; successes += s.successes; }

  std::ofstream ofs(args.out);
  ofs << "readers,bins,attempts,successes,success_ratio\n";
  ofs << args.readers << "," << args.bins << "," << attempts << "," << successes << "," << (double(successes)/double(attempts)) << "\n";
  ofs.close();

  std::cout << "Wrote " << args.out << ": success ratio=" << (double(successes)/double(attempts)) << std::endl;
  return 0;
}

