/**
 * @docauthor Joel Watson <existdissolve@gmail.com>
 *
 * The SpeechRecognition class provides a handy wrapper to the (currently webkit only) implementation of the still-in-progress
 * HTML5 specification for Speech Recognition. This class is currently only an API to webkit's implementation the Speech Recognition
 * spec; the developer is responsible for interacting with the raised events to accomplish what they desire to do
 *
 * A plugin for interacting with components will be coming in the future, although the extent of the currently supported events
 * make integration with current components rather trivial.
 */
Ext.define( 'Ext.ux.SpeechRecognition', {
    mixins: {
        observable: 'Ext.util.Observable'
    },
    /**
     * @cfg {Boolean} [continuous=false]
     * When false, only one final result is returned in response to starting recognition
     * When true, zero or more results will be returned representing multiple recognitions
     */
    continuous: false,
    /**
     * @cfg {Boolean} [continuous=false]
     * Whether or not interim results are returned. Particularly useful as "true" when you want instant feedback
     */
    interimResults: false,
    /**
     * @cfg {String}
     * The language to be used for the recognition request. If null, will default to the language of the html document
     */
    lang: null,
    /**
     * @cfg {Number} [maxAlternatives=1]
     * The maximum number of recognition alternative results that are returned for each request
     */
    maxAlternatives: 1,
    /**
     * @cfg {String}
     * The location of the speech recognition service to be used for recognition
     */
    serviceURI: null,
    /**
     * @cfg {Number} [minimumConfidenceLevel=.5]
     * The minimum confidence level which a recognition result must achieve in order to be added to the internal result store
     * Valid values are between 0 and 1
     */
    minimumConfidenceLevel: .5,
    /**
     * @cfg {Boolean} [logFinalOnly=true]
     * Whether or not only "final" recognition results should be logged
     */
    logFinalOnly: false,
    /**
     * @cfg {Boolean} [chainTranscripts=false]
     * When true, transcripts can be appended to one another, such as in a dictation scenario
     * When false, transcripts will be cleared on the start of a new recognition session
     */
    chainTranscripts: false,
    /**
     * @cfg {Object}
     * Collection of grammars that are active for the recognition (not currently supported)
     */
    grammars: null,
    /**
     * @property {boolean} recognizing
     * The state of the recognition
     */
    recognizing: false,
    /**
     * @property {String} finalTranscript
     * The final transcript as it exists after the recognition event has ended
     */
    finalTranscript: '',
    /**
     * Creates our Speech Recognition wrapper
     * @param {Object} [config] Config object.
     */
    constructor: function( config ) {
        var me = this;
        config = config || {};
        me.mixins.observable.constructor.call( me, config );
        // setup speech API
        me.speech = new webkitSpeechRecognition();
        Ext.apply( me.speech, config );
        // results
        me.results = Ext.create('Ext.data.Store', {
            fields: [
                { name: 'confidence', type: 'float' },
                { name: 'transcript', type: 'string' },
                { name: 'isFinal', type: 'boolean', defaultValue: false },
                { name: 'isMostConfident', type:'boolean', defaultValue: false },
                { name: 'timeStamp', type: 'int' }
            ]
        });
        me.interimTranscript = '';
        // initialize durations
        me.initDurations();
        
        /**
         * @event audiostart
         * Fires when user agent has begun capturing audio
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {Object} duration A hash of timestamps representing the start and stop times for this event
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event audioend
         * Fires when user agent has stopped capturing audio
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {Object} duration A hash of timestamps representing the start and stop times for this event
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event soundstart
         * Fired when sound (maybe speech?) has been deteced
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {Object} duration A hash of timestamps representing the start and stop times for this event
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event soundend
         * Fired when sound is no longer detected
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {Object} duration A hash of timestamps representing the start and stop times for this event
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event speechstart
         * Fired when speech is detected
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {Object} duration A hash of timestamps representing the start and stop times for this event
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event speechend
         * Fires when speech is no longer detected
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {Object} duration A hash of timestamps representing the start and stop times for this event
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event start
         * Fired when recognition service has begun to listen to audio for recognition purposes
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event end
         * Fires when recognition service is disconnected
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event result
         * Fires when speech recognition service returns a result
         * @param {Ext.ux.SpeechRecognition} this
         * @param {String} transcript The current state of the transcript based on the result from the service
         * @param {Ext.data.Store} store The internal store used for tracking results
         * @param {Array} rawResults The raw result objects returned from the recognition service
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event nomatch
         * Fired when the speech recognizer returns a below-confidence-threshold final result
         * @param {Ext.ux.SpeechRecognition} this
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */
        /**
         * @event error
         * Fired when a recognition error occurs
         * @param {Ext.ux.SpeechRecognition} this
         * @param {Number} timestamp The timestamp of representing when the event occurred
         * @param {String} error The error type which occurred
         * @param {String} message Any message provided as a part of the event by the implementing context
         * @param {SpeechRecognitionEvent} e The original event raised by the Recognition instance
         */

        // bind events
        me.speech.onstart = Ext.Function.bind( me.onStart, me );
        me.speech.onend = Ext.Function.bind( me.onEnd, me );
        me.speech.onspeechstart = Ext.Function.bind( me.onSpeechStart, me );
        me.speech.onspeechend = Ext.Function.bind( me.onSpeechEnd, me );
        me.speech.onresult = Ext.Function.bind( me.onResult, me );
        me.speech.onerror = Ext.Function.bind( me.onError, me );
        me.speech.onaudioend = Ext.Function.bind( me.onAudioEnd, me );
        me.speech.onaudiostart = Ext.Function.bind( me.onAudioStart, me );
        me.speech.onnomatch = Ext.Function.bind( me.onNoMatch, me );
        me.speech.onsoundend = Ext.Function.bind( me.onSoundEnd, me );
        me.speech.onsoundstart = Ext.Function.bind( me.onSoundStart, me );       
    },
    /**
     * @private
     * Sets up a simple tracker object for timestamps across the various time-sensitive areas of the API
     */
    initDurations: function() {
        var me = this;
        me.durations = {
            audio: { start: 0, end: 0 },
            sound: { start: 0, end: 0 },
            speech:{ start: 0, end: 0 },
            timer: { start: 0, end: 0 }
        };
    },
    /**
     * Initiates a recognition session by calling start() on the native API
     */
    start: function() {
        var me = this;
        // set recognizing to true
        me.recognizing = true;
        me.speech.start();
    },
    /**
     * Gracefully ends a recognition session by calling stop() on the native API
     */
    stop: function() {
        var me = this;
        // set recognizing to false
        me.recognizing = false;
        me.speech.stop();
    },
    /**
     * Instantly shuts down the recognition session by calling abort() on the native API
     */
    abort: function() {
        var me = this;
        // set recognizing to false
        me.recognizing = false;
        me.speech.abort();
    },
    /**
     * Determines if a recognition session is currently in progress
     * @return {Boolean}
     */
    isInProgress: function() {
        var me = this;
        return me.recognizing;
    },
    /**
     * Retrieves the "final" transcript for the recognition object
     * @return {String}
     */
    getFinalTranscript: function() {
        var me = this;
        return me.finalTranscript;
    },
    /**
     * If a session is currently in progress, retrieves the current state of the interim transcript
     * @return {String}
     */
    getCurrentTranscript: function() {
        var me = this;
        return me.interimTranscript;
    },
    /**
     * Retrieves the calculated duration of the speech object
     * @return {Float}
     */
    getSpeechDuration: function() {
        var me = this;
        return me.calculateDuration( me.durations.speech.start, me.durations.speech.end );
    },
    /**
     * Retrieves the calculated duration of the audio object
     * @return {Float}
     */
    getAudioDuration: function() {
        var me = this;
        return me.calculateDuration( me.durations.audio.start, me.durations.audio.end );
    },
    /**
     * Retrieves the calculated duration of the sound object
     * @return {Float}
     */
    getSoundDuration: function() {
        var me = this;
        return me.calculateDuration( me.durations.sound.start, me.durations.sound.end );
    },
    /**
     * Retrieves the calculated duration of the recognition session
     * @return {Float}
     */
    getDuration: function() {
        var me = this;
        return me.calculateDuration( me.durations.timer.start, me.durations.timer.end );
    },
    /**
     * @private
     * Calculates the duration of a timer object
     * @return {Float}
     */
    calculateDuration: function( start, end ) {
        return (end - start) / 1000;
    },
    /**
     * @private
     * Internal class method for bridging event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onStart: function( e ) {
        var me = this;
        // set start time
        me.durations.timer.start = e.timeStamp;
        // fire event
        me.fireEvent( 'start', me, e.timeStamp, e );
    },
    /**
     * @private
     * Internal class method for bridging event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onEnd: function( e ) {
        var me = this;
        // set end time
        me.durations.timer.end = e.timeStamp;
        // set final transcript based on configuration
        if( me.chainTranscripts ) {
            me.finalTranscript += ' ' + me.interimTranscript;
        }
        else {
            me.finalTranscript = me.interimTranscript;
        }
        // fire event
        me.fireEvent( 'end', me, e.timeStamp, e );
    },
    /**
     * @private
     * Internal class method for bridging event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onResult: function( e ) {
        var me = this,
            canLog=true,
            rawResults = [],
            hash,
            result,
            alternative,
            transcript='';
        // loop over results
        for( var i=0; i < e.results.length; i++ ) {
            result = e.results[ i ];
            // if finalOnly config is true and this is not a final result, set flag to false
            canLog = me.logFinalOnly && !result.isFinal ? false : true;
            // loop over alternatives
            for( var x=0; x < result.length; x++ ) {
                alternative = result[ x ];
                // accomodate minimumConfidenceLevels
                hash = {
                    transcript: alternative.transcript,
                    confidence: alternative.confidence,
                    isFinal: result.isFinal,
                    timeStamp: e.timeStamp,
                    isMostConfident: x==0 ? true : false
                };
                // add to raw cache
                rawResults.push( hash );
                // if we can log and the confidence level exceeds min setting
                if( canLog && me.minimumConfidenceLevel <= alternative.confidence ) {
                    // add to store
                    me.results.add( hash );
                    // if most confident, add to scoped transcript
                    if( hash.isMostConfident ) {
                        transcript += hash.transcript;
                    }
                }
            }
        }
        // set interim transcript
        me.interimTranscript = transcript;
        // fire event
        me.fireEvent( 'result', me, transcript, me.results.store, rawResults, e );
    },
    /**
     * @private
     * Internal class method for bridging onspeechstart event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onSpeechStart: function( e ) {
        var me = this;
        // set start time
        me.durations.speech.start = e.timeStamp;
        // fire event
        me.fireEvent( 'speechstart', me, e.timeStamp, me.durations.speech, e );
    },
    /**
     * @private
     * Internal class method for bridging onspeechend event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onSpeechEnd: function( e ) {
        var me = this,
            store = me.results.store,
            startIndex = me.results.lastStartIndex,
            result;
        // set end time
        me.durations.speech.end = e.timeStamp;
        // fire event
        me.fireEvent( 'speechend', me, e.timeStamp, me.durations.speech, e );
    },
    /**
     * @private
     * Internal class method for bridging onaudiostart event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onAudioStart: function( e ) {
        var me = this;
        // set end time
        me.durations.audio.start = e.timeStamp;
        // fire event
        me.fireEvent( 'audiostart', me, e.timeStamp, me.durations.audio, e );
    },
    /**
     * @private
     * Internal class method for bridging onaudioend event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onAudioEnd: function( e ) {
        var me = this;
        // set end time
        me.durations.audio.end = e.timeStamp;
        // fire event
        me.fireEvent( 'audioend', me, e.timeStamp, me.durations.audio, e );
    },
    /**
     * @private
     * Internal class method for bridging onsoundstart event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onSoundStart: function( e ) {
        var me = this;
        // set end time
        me.durations.sound.start = e.timeStamp;
        // fire event
        me.fireEvent( 'soundstart', me, e.timeStamp, me.durations.sound, e );
    },
    /**
     * @private
     * Internal class method for bridging onsoundend event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onSoundEnd: function( e ) {
        var me = this;
        // set end time
        me.durations.sound.end = e.timeStamp;
        // fire event
        me.fireEvent( 'soundend', me, e.timeStamp, me.durations.sound, e );
    },
    /**
     * @private
     * Internal class method for bridging onnomatch event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onNoMatch: function( e ) {
        var me = this;
        me.fireEvent( 'nomatch', me, e );
    },
    /**
     * @private
     * Internal class method for bridging onerror event from native API to wrapper class
     * @param {Ext.EventObject} e
     */
    onError: function( e ) {
        var me = this;
        // fire event
        me.fireEvent( 'error', me, e.timeStamp, e.error, e.message, e );
    }
});