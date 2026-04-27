"use strict";
/**
 * Intelligent Site Selection System for Browser-Use Tool
 *
 * This module provides AI-powered site selection, relevance assessment, and strategic
 * navigation capabilities to enhance the browser-use tool's research efficiency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingLevel = exports.CacheStrategy = exports.URLCategory = exports.ProcessingLevel = exports.ContentType = exports.NavigationApproach = exports.RiskLevel = exports.ResearchPhase = void 0;
var ResearchPhase;
(function (ResearchPhase) {
    ResearchPhase["DISCOVERY"] = "discovery";
    ResearchPhase["ANALYSIS"] = "analysis";
    ResearchPhase["VALIDATION"] = "validation";
    ResearchPhase["COMPLETION"] = "completion";
})(ResearchPhase || (exports.ResearchPhase = ResearchPhase = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var NavigationApproach;
(function (NavigationApproach) {
    NavigationApproach["BREADTH_FIRST"] = "breadth_first";
    NavigationApproach["DEPTH_FIRST"] = "depth_first";
    NavigationApproach["TARGETED"] = "targeted";
    NavigationApproach["ADAPTIVE"] = "adaptive";
})(NavigationApproach || (exports.NavigationApproach = NavigationApproach = {}));
var ContentType;
(function (ContentType) {
    ContentType["PRICING"] = "pricing";
    ContentType["FEATURES"] = "features";
    ContentType["DOCUMENTATION"] = "documentation";
    ContentType["REVIEWS"] = "reviews";
    ContentType["PRODUCT"] = "product";
    ContentType["ADMINISTRATIVE"] = "administrative";
    ContentType["MEDIA"] = "media";
    ContentType["IRRELEVANT"] = "irrelevant";
})(ContentType || (exports.ContentType = ContentType = {}));
var ProcessingLevel;
(function (ProcessingLevel) {
    ProcessingLevel["SKIP"] = "skip";
    ProcessingLevel["HEURISTIC_ONLY"] = "heuristic_only";
    ProcessingLevel["LIGHT_AI"] = "light_ai";
    ProcessingLevel["DEEP_AI"] = "deep_ai";
})(ProcessingLevel || (exports.ProcessingLevel = ProcessingLevel = {}));
var URLCategory;
(function (URLCategory) {
    URLCategory["PRICING"] = "pricing";
    URLCategory["FEATURES"] = "features";
    URLCategory["DOCUMENTATION"] = "documentation";
    URLCategory["REVIEWS"] = "reviews";
    URLCategory["PRODUCT"] = "product";
    URLCategory["ADMINISTRATIVE"] = "administrative";
    URLCategory["MEDIA"] = "media";
    URLCategory["IRRELEVANT"] = "irrelevant";
})(URLCategory || (exports.URLCategory = URLCategory = {}));
var CacheStrategy;
(function (CacheStrategy) {
    CacheStrategy["AGGRESSIVE"] = "aggressive";
    CacheStrategy["BALANCED"] = "balanced";
    CacheStrategy["CONSERVATIVE"] = "conservative";
})(CacheStrategy || (exports.CacheStrategy = CacheStrategy = {}));
var LoggingLevel;
(function (LoggingLevel) {
    LoggingLevel["NONE"] = "none";
    LoggingLevel["ERROR"] = "error";
    LoggingLevel["WARN"] = "warn";
    LoggingLevel["INFO"] = "info";
    LoggingLevel["DEBUG"] = "debug";
    LoggingLevel["VERBOSE"] = "verbose";
    LoggingLevel["TRACE"] = "trace";
})(LoggingLevel || (exports.LoggingLevel = LoggingLevel = {}));
