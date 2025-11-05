#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <vector>
#include <map>
#include <functional>
#include <memory>

/**
 * Network Analytics Engine
 * Provides comprehensive network performance monitoring, predictive analysis,
 * and automated optimization recommendations
 */

// Forward declarations
class MetricsCollector;
class PredictiveAnalyzer;
class AlertManager;
class ReportGenerator;

/**
 * Analytics Configuration
 */
struct AnalyticsConfig {
    // Data collection settings
    uint32_t metrics_collection_interval_ms = 1000;
    uint32_t detailed_analysis_interval_ms = 60000;
    uint32_t report_generation_interval_ms = 3600000;  // 1 hour
    
    // Storage settings
    uint16_t max_metrics_history = 1440;  // 24 hours at 1-minute intervals
    uint16_t max_events_history = 10000;
    bool enable_persistent_storage = true;
    
    // Analysis settings
    bool enable_predictive_analysis = true;
    bool enable_anomaly_detection = true;
    bool enable_trend_analysis = true;
    uint32_t baseline_learning_period_ms = 604800000;  // 7 days
    
    // Alerting settings
    bool enable_automated_alerts = true;
    uint8_t alert_sensitivity = 5;  // 1-10 scale
    uint32_t alert_cooldown_ms = 300000;  // 5 minutes
    
    // Export settings
    bool enable_json_export = true;
    bool enable_csv_export = false;
    bool enable_influxdb_export = false;
    String influxdb_url = "";
    String influxdb_token = "";
    String influxdb_bucket = "k1_metrics";
    
    // Performance thresholds
    uint32_t throughput_warning_threshold_kbps = 1000;
    uint32_t throughput_critical_threshold_kbps = 500;
    uint16_t latency_warning_threshold_ms = 100;
    uint16_t latency_critical_threshold_ms = 500;
    float packet_loss_warning_threshold = 1.0f;
    float packet_loss_critical_threshold = 5.0f;
    int8_t signal_strength_warning_threshold_dbm = -70;
    int8_t signal_strength_critical_threshold_dbm = -80;
};

/**
 * Comprehensive Network Metrics
 */
struct NetworkMetrics {
    uint32_t timestamp;
    
    // Basic connectivity
    bool is_connected;
    String ssid;
    uint8_t bssid[6];
    uint8_t channel;
    wifi_auth_mode_t auth_mode;
    
    // Signal quality
    int8_t rssi_dbm;
    uint8_t signal_quality_percent;
    int8_t noise_floor_dbm;
    float snr_db;
    
    // Throughput metrics
    uint32_t rx_throughput_kbps;
    uint32_t tx_throughput_kbps;
    uint32_t total_throughput_kbps;
    uint32_t rx_bytes_total;
    uint32_t tx_bytes_total;
    
    // Latency and quality
    uint16_t ping_latency_ms;
    uint16_t dns_latency_ms;
    uint16_t http_latency_ms;
    uint16_t jitter_ms;
    float packet_loss_percent;
    
    // Connection stability
    uint32_t connection_uptime_ms;
    uint16_t reconnection_count;
    uint16_t auth_failures;
    uint32_t last_disconnect_reason;
    
    // Channel utilization
    float channel_utilization_percent;
    uint8_t interfering_networks_count;
    int8_t strongest_interferer_rssi_dbm;
    
    // Advanced metrics
    uint16_t retry_count;
    uint16_t duplicate_count;
    float phy_rate_mbps;
    uint8_t mcs_index;
    uint8_t spatial_streams;
    
    // Power and thermal
    wifi_power_t tx_power;
    float power_consumption_mw;
    int16_t temperature_celsius;
    
    // Application-specific
    uint32_t led_frame_rate;
    uint32_t audio_sample_rate;
    uint16_t pattern_switches_per_hour;
    uint32_t api_requests_per_hour;
};

/**
 * Performance Alert Types
 */
enum class AlertType : uint8_t {
    // Performance alerts
    LOW_THROUGHPUT = 1,
    HIGH_LATENCY = 2,
    PACKET_LOSS = 3,
    WEAK_SIGNAL = 4,
    CHANNEL_CONGESTION = 5,
    
    // Stability alerts
    FREQUENT_DISCONNECTIONS = 10,
    AUTH_FAILURES = 11,
    CONNECTION_TIMEOUT = 12,
    ROAMING_ISSUES = 13,
    
    // Quality alerts
    HIGH_JITTER = 20,
    POOR_SNR = 21,
    INTERFERENCE_DETECTED = 22,
    CHANNEL_UTILIZATION_HIGH = 23,
    
    // System alerts
    HIGH_TEMPERATURE = 30,
    POWER_CONSUMPTION_HIGH = 31,
    MEMORY_USAGE_HIGH = 32,
    CPU_USAGE_HIGH = 33,
    
    // Predictive alerts
    PERFORMANCE_DEGRADATION_PREDICTED = 40,
    FAILURE_PREDICTED = 41,
    MAINTENANCE_REQUIRED = 42,
    CAPACITY_LIMIT_APPROACHING = 43
};

/**
 * Performance Alert Structure
 */
struct PerformanceAlert {
    AlertType type;
    uint32_t timestamp;
    uint8_t severity;  // 1=Info, 5=Warning, 10=Critical
    String description;
    float current_value;
    float threshold_value;
    String recommended_action;
    bool acknowledged;
    uint32_t acknowledgment_timestamp;
    String acknowledgment_user;
};

/**
 * Trend Analysis Data
 */
struct TrendAnalysis {
    enum TrendDirection {
        IMPROVING,
        STABLE,
        DEGRADING,
        UNKNOWN
    };
    
    struct MetricTrend {
        String metric_name;
        TrendDirection direction;
        float change_rate_per_hour;
        float confidence_percent;
        uint32_t analysis_period_ms;
        String description;
    };
    
    std::vector<MetricTrend> trends;
    uint32_t analysis_timestamp;
    uint32_t next_analysis_timestamp;
};

/**
 * Predictive Analysis Results
 */
struct PredictiveAnalysis {
    struct Prediction {
        String metric_name;
        float predicted_value;
        float confidence_percent;
        uint32_t prediction_horizon_ms;
        bool threshold_breach_predicted;
        uint32_t predicted_breach_timestamp;
        String impact_description;
    };
    
    std::vector<Prediction> predictions;
    uint32_t analysis_timestamp;
    String model_version;
    float overall_health_score;  // 0-100
};

/**
 * Network Optimization Recommendations
 */
struct OptimizationRecommendation {
    enum Priority {
        LOW = 1,
        MEDIUM = 5,
        HIGH = 10
    };
    
    enum Category {
        CHANNEL_OPTIMIZATION,
        POWER_OPTIMIZATION,
        QOS_TUNING,
        SECURITY_ENHANCEMENT,
        INFRASTRUCTURE_UPGRADE
    };
    
    Category category;
    Priority priority;
    String title;
    String description;
    String implementation_steps;
    float expected_improvement_percent;
    uint32_t implementation_effort_hours;
    bool auto_implementable;
    String prerequisites;
};

/**
 * Network Analytics Engine Class
 */
class NetworkAnalyticsEngine {
public:
    // Callback function types
    using MetricsCallback = std::function<void(const NetworkMetrics&)>;
    using AlertCallback = std::function<void(const PerformanceAlert&)>;
    using TrendCallback = std::function<void(const TrendAnalysis&)>;
    using PredictionCallback = std::function<void(const PredictiveAnalysis&)>;
    
    // Constructor/Destructor
    NetworkAnalyticsEngine();
    ~NetworkAnalyticsEngine();
    
    // Initialization and configuration
    bool initialize(const AnalyticsConfig& config);
    void updateConfig(const AnalyticsConfig& config);
    AnalyticsConfig getConfig() const;
    
    // Main processing loop
    void loop();
    
    // Metrics collection
    void collectMetrics();
    NetworkMetrics getCurrentMetrics() const;
    std::vector<NetworkMetrics> getMetricsHistory(uint32_t duration_ms = 3600000) const;
    void addCustomMetric(const String& name, float value, const String& unit = "");
    
    // Performance monitoring
    void startMonitoring();
    void stopMonitoring();
    bool isMonitoring() const;
    void setMonitoringInterval(uint32_t interval_ms);
    
    // Alert management
    void checkThresholds();
    std::vector<PerformanceAlert> getActiveAlerts() const;
    std::vector<PerformanceAlert> getAlertHistory(uint32_t duration_ms = 86400000) const;
    void acknowledgeAlert(uint32_t alert_id, const String& user = "system");
    void clearAcknowledgedAlerts();
    void addCustomThreshold(const String& metric, float warning, float critical);
    
    // Trend analysis
    TrendAnalysis analyzeTrends(uint32_t analysis_period_ms = 3600000);
    void enableTrendAnalysis(bool enable = true);
    std::vector<TrendAnalysis> getTrendHistory() const;
    
    // Predictive analysis
    PredictiveAnalysis generatePredictions(uint32_t horizon_ms = 3600000);
    void enablePredictiveAnalysis(bool enable = true);
    void trainPredictiveModel();
    float getModelAccuracy() const;
    
    // Optimization recommendations
    std::vector<OptimizationRecommendation> generateRecommendations();
    void implementRecommendation(uint32_t recommendation_id);
    void trackRecommendationEffectiveness(uint32_t recommendation_id);
    
    // Baseline management
    void startBaselineLearning();
    void stopBaselineLearning();
    bool isLearningBaseline() const;
    void resetBaseline();
    float getBaselineDeviation(const String& metric) const;
    
    // Anomaly detection
    void enableAnomalyDetection(bool enable = true);
    std::vector<String> detectAnomalies(const NetworkMetrics& metrics);
    void setAnomalyThreshold(float threshold);  // Standard deviations from baseline
    
    // Reporting
    String generatePerformanceReport(uint32_t period_ms = 86400000);
    String generateHealthReport();
    String generateTrendReport();
    String generatePredictiveReport();
    void scheduleReport(const String& report_type, uint32_t interval_ms);
    
    // Data export
    void exportMetricsToJSON(String& output, uint32_t duration_ms = 3600000);
    void exportMetricsToCSV(String& output, uint32_t duration_ms = 3600000);
    void exportToInfluxDB();
    void exportToPrometheus(String& output);
    
    // Callback registration
    void onMetricsUpdate(MetricsCallback callback);
    void onAlert(AlertCallback callback);
    void onTrendAnalysis(TrendCallback callback);
    void onPrediction(PredictionCallback callback);
    
    // Configuration persistence
    bool saveConfigToNVS();
    bool loadConfigFromNVS();
    bool saveMetricsToNVS();
    bool loadMetricsFromNVS();
    
    // System health
    float getOverallHealthScore() const;
    String getHealthSummary() const;
    std::map<String, float> getHealthMetrics() const;
    
    // Performance benchmarking
    void runPerformanceBenchmark();
    void compareWithBaseline();
    void generateBenchmarkReport(String& output);
    
private:
    // Internal state
    AnalyticsConfig config_;
    std::vector<NetworkMetrics> metrics_history_;
    std::vector<PerformanceAlert> active_alerts_;
    std::vector<PerformanceAlert> alert_history_;
    std::vector<TrendAnalysis> trend_history_;
    std::vector<PredictiveAnalysis> prediction_history_;
    std::vector<OptimizationRecommendation> recommendations_;
    
    // Baseline data
    std::map<String, float> baseline_means_;
    std::map<String, float> baseline_stddevs_;
    bool is_learning_baseline_;
    uint32_t baseline_start_timestamp_;
    
    // Custom metrics
    std::map<String, float> custom_metrics_;
    std::map<String, String> custom_metric_units_;
    
    // Callback storage
    MetricsCallback metrics_callback_;
    AlertCallback alert_callback_;
    TrendCallback trend_callback_;
    PredictionCallback prediction_callback_;
    
    // Timing variables
    uint32_t last_metrics_collection_ms_;
    uint32_t last_analysis_ms_;
    uint32_t last_prediction_ms_;
    uint32_t last_export_ms_;
    uint32_t last_cleanup_ms_;
    
    // Internal modules
    std::unique_ptr<MetricsCollector> metrics_collector_;
    std::unique_ptr<PredictiveAnalyzer> predictive_analyzer_;
    std::unique_ptr<AlertManager> alert_manager_;
    std::unique_ptr<ReportGenerator> report_generator_;
    
    // Internal methods
    void processMetrics(const NetworkMetrics& metrics);
    void updateBaseline(const NetworkMetrics& metrics);
    void checkForAnomalies(const NetworkMetrics& metrics);
    void generateAlert(AlertType type, const String& description, float value, float threshold);
    void cleanupOldData();
    
    // Statistical analysis
    float calculateMean(const std::vector<float>& values);
    float calculateStandardDeviation(const std::vector<float>& values, float mean);
    float calculateTrend(const std::vector<float>& values, const std::vector<uint32_t>& timestamps);
    float calculateCorrelation(const std::vector<float>& x, const std::vector<float>& y);
    
    // Predictive modeling
    struct PredictiveModel {
        std::vector<float> weights;
        float bias;
        float accuracy;
        uint32_t training_samples;
        uint32_t last_training_timestamp;
    };
    
    std::map<String, PredictiveModel> predictive_models_;
    void trainModel(const String& metric_name);
    float predict(const String& metric_name, const std::vector<float>& features);
    
    // Optimization algorithms
    void analyzeChannelPerformance();
    void analyzePowerEfficiency();
    void analyzeQoSEffectiveness();
    OptimizationRecommendation generateChannelRecommendation();
    OptimizationRecommendation generatePowerRecommendation();
    OptimizationRecommendation generateQoSRecommendation();
    
    // Utility functions
    float extractMetricValue(const NetworkMetrics& metrics, const String& metric_name);
    String formatDuration(uint32_t duration_ms);
    String formatTimestamp(uint32_t timestamp);
    String formatFloat(float value, uint8_t decimals = 2);
    
    // NVS key constants
    static constexpr const char* NVS_NAMESPACE = "analytics";
    static constexpr const char* NVS_CONFIG_KEY = "config";
    static constexpr const char* NVS_METRICS_KEY = "metrics";
    static constexpr const char* NVS_BASELINE_KEY = "baseline";
    static constexpr const char* NVS_MODELS_KEY = "models";
};

/**
 * Global instance accessor
 */
NetworkAnalyticsEngine& getNetworkAnalyticsEngine();

/**
 * Analytics utility functions
 */
namespace AnalyticsUtils {
    // Statistical utilities
    float calculatePercentile(const std::vector<float>& values, float percentile);
    float calculateMedian(const std::vector<float>& values);
    std::pair<float, float> calculateConfidenceInterval(const std::vector<float>& values, float confidence = 0.95f);
    
    // Time series utilities
    std::vector<float> smoothData(const std::vector<float>& data, uint8_t window_size = 5);
    std::vector<float> detectOutliers(const std::vector<float>& data, float threshold = 2.0f);
    float calculateSeasonality(const std::vector<float>& data, uint32_t period);
    
    // Performance utilities
    String classifyPerformance(float value, float good_threshold, float poor_threshold);
    uint8_t calculateHealthScore(const std::map<String, float>& metrics);
    String generateInsight(const String& metric, float current, float baseline, float trend);
    
    // Export utilities
    String metricsToJSON(const std::vector<NetworkMetrics>& metrics);
    String metricsToCSV(const std::vector<NetworkMetrics>& metrics);
    String alertsToJSON(const std::vector<PerformanceAlert>& alerts);
}