"use strict";
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
			'xclass',
			'matreshka_dir/dollar-lib',
			'matreshka_dir/polyfills/number.isnan'
		], factory);
    } else {
        root.MK = root.Matreshka = factory( root.Class, root.__DOLLAR_LIB );
    }
}(this, function ( Class, $ ) {
if( !Class ) {
	throw new Error( 'Class function is missing' );
}
if( ![].forEach ) {
	throw Error( 'If you\'re using Internet Explorer 8 you should use es5-shim: https://github.com/kriskowal/es5-shim' );
}
/*
done:
	new addDependence syntax
	return this from initializeSmartArray
	renamed addDependence to addDependency
	useAs$
	requirejs file structure
	MK.procrastinate
	defined 3 modules: matreshka, balalaika and xclass
	createfrom accepts undefined
	initialize binder member
	another args for binder members
	xclass.same() method

//-------
ANOTHER COMMIT:
	MK#defineSetter
	optimized MK#bound
	changed cases when modify event is fired on MK.Array
	use 'delete' instead of 'remove' event in MK (core) because MK.Array has same event name that fires on another action
	$b.create static method
	throw error if no [].forEach
	fixed bug in balalaika parser
	added $b.fn.is for IE8
	addEventListener as polyfill (IE8 is not depended from jQuery from now)
	experimental '@evtName' event name for MK.Array and  MK.Object
	experimental 'key@evtName' event name for MK (core)
	fixed bug in MK#once, now handler could be removed by MK#off method
	allow adding eventName + eventHandler + context triad only once per instance (close to EventTarget.prototype.addEventListener behavior, where one handler function can be added only once per event name)

todo:
	review code (remove sucked variables and properties such as silentChangeEvent etc)
	bindings in html
	MK.Array#empty
	MK#setConst
	remove MK.Array itemrender event, it will be replaced by @render
	'on' binder key as function that accepts callback
	[maybe] turn on/off warnings (bound element is missing etc)
	MK.Object and MK.Array on, off methods docs
*/
/**
 * @private
 * @since 0.0.4
 * @todo optimize
 */
var domEventsMap = {
	list: {},
	add: function( o ) {
		if( o.on ) {
			$( o.el ).on( o.on.split( /\s/ ).join( '.mk ' ) + '.mk', o.handler );
		}
		
		( this.list[ o.instance.__id ] = this.list[ o.instance.__id ] || [] ).push( o );
	},
	rem: function( o ) {
		var evts = this.list[ o.instance.__id ],
			evt;
		if( !evts ) return;
		for( var i = 0; i < evts.length; i++ ) {
			evt = evts[ i ];
			if( evt.el !== o.el ) continue;
			o.instance.off( '_change:' + o.key, evt.mkHandler );
			$( o.el ).off( evt.on + '.mk', evt.handler );
			this.list[ o.instance.__id ].splice( i--, 1 );
		}
	}
},
warn = function( warning ) {
	window.console && console.warn && console.warn( warning );
},
warnDeprecated = function( oldM, newM ) {
	if( !warnDeprecated[ oldM ] ) {
		warn( 'Method Matreshka' + oldM + ' is deprecated. Please use Matreshka' + newM + ' instead.' );
		warnDeprecated[ oldM ] = true;
	}
};


/**
 * @class Matreshka
 * @version 0.1
 * @author Andrey Gubanov <a@odessite.com.ua>
 * @license {@link https://raw.github.com/finom/matreshka/master/LICENSE MIT}
 * Version 2.0, January 2004
 * @alias MK
 * @example <caption>Basic usage</caption>
 * var m = new Matreshka;
 * @example <caption>Using MK synonim</caption>
 * var m = new MK;
 * @example <caption>Inheritance</caption>
 * var MyClass = Class({
 * 	'extends': Matreshka,
 * 	method: function() {
 * 		this.initMK();
 *  }
 * });
*/
var Matreshka,
MK = Matreshka = Class({
	//__special: null, // { <key>: { getter: f, elements: jQ, value: 4 }}
	//__events: null,
	/**
	 * @member {boolean} Matreshka#isMK
	 * @summary <code>isMK</code> is always </code>true</code>. It using for easy detecting Matreshka instance.
	 */
	isMK: true,
	/**
	 * @private
	 * @member {boolean} Matreshka#isMKInitialized
	 * @summary Using for "Lazy initialization".
	 */
	isMKInitialized: false,
	/** 
	 * @method Matreshka#on
	 * @summary Attaches an event handler to the self
	 * @todo Refactoring
	 * @desc The {@link Matreshka#on} method attaches event handler to the Matreshka instance. The event could be triggered by {@link Matreshka#trigger} method. 
	 * You can pass <code>"change:myKey"</code> as first {@link Matreshka#on} argument to monitor <code>"myKey"</code> property changes.
	 * @param {eventNames} names - Names of the space-delimited list of events (eg. "change:x ajaxcomplete change:y")
	 * @param {eventHandler} callback - A function to execute when the event is triggered
	 * @param {boolean} [triggerOnInit=false] - If <code>triggerOnInit</code> equals to <code>true</code> then an event handler will be triggered immediately
	 * @param {object} [context] - An object to use as <code>this</code>when executing <code>callback</code>
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.on( 'change:x', function() {
	 *   alert( 'x is changed' );
	 * });
	 * this.x = Math.random();
	 * @example <caption>Passing context</caption>
	 * //Alert will be execuded in window context and display second argument,
	 * //that has been passed to .trigger method
	 * this.on( 'ohmygosh', alert, window );
	 * this.trigger( 'ohmygosh', 'Hello world' );
	 * @example <caption>Calling event handler immediately after initialization</caption>
	 * //Alerts "bar" immediately and waits for triggering "foo" event
	 * this.on( 'foo', function() {
	 *   alert( 'bar' );
	 * }, true );
	 */
	on: function ( names, callback, triggerOnInit, context, xtra ) {
		if( !callback ) throw Error( 'callback is not function for event(s) "'+names+'"' );
		var events,
			ev,
			names = names.split( /\s/ ),
			name,
			ctx,
			key,
			domEvt,
			domEvtName,
			domEvtKey,
			indexOfET,
			_this = this,
			t;
		
		
		if( typeof triggerOnInit !== 'boolean' && typeof triggerOnInit !== 'undefined' ) {
			t = context;
			context = triggerOnInit;
			triggerOnInit = t;
		}
		
		ctx = context || _this;
		for( var i = 0; i < names.length; i++ ) {
			name = names[ i ];
			// x@evtName
			indexOfET = name.indexOf( '@' );
			if( ~indexOfET ) {
				( function( key, name ) {
					var f = function( evt ) {
						var target = _this[ key ];
						if( target && target.isMK ) {
							target.on( name, callback, triggerOnInit, context || _this );
						}
						
						if( evt && evt.previousValue && evt.previousValue.isMK ) {
							evt.previousValue.off( name, callback, context );
						}
					};
					f._callback = callback;
					_this.on( 'change:' + key, f, true, _this, name );
				})( name.slice( 0, indexOfET ), name.slice( indexOfET + 1 ) );
			} else {
				events = _this.__events[ name ] || (_this.__events[ name ] = []);
				ev = {
					callback: callback,
					context: context,
					ctx: ctx,
					xtra: xtra
				};
				
				if( !events.some( function( ev2 ) {
					return ev2.callback === ev.callback && ev2.callback._callback === ev.callback && ev2.context === ev.context;
				}) ) {
					events.push( ev );
					
					// change:x
					if( name.indexOf( 'change:' ) === 0 ) {
						_this.makeSpecial( name.replace( 'change:', '' ) );
					}
					
					// click::x
					domEvt = name.split( '::' );
					domEvtName = domEvt[ 0 ];
					domEvtKey = domEvt[ 1 ]; 
					if( domEvtKey && _this.__special[ domEvtKey ] ) {
						( function( evtName ) {
							_this.__special[ domEvtKey ].elements.on( domEvtName + '.' + _this.__id + domEvtKey, function() {
								var args = [].slice.call( arguments );
								extend( args[ 0 ], {
									self: _this,
									element: this,
									elements: $( this ),
									key: domEvt[ 1 ]
								});
								
								args.unshift( evtName );
								_this.trigger.apply( _this, args );
							});
						})( name );
					}
				}
			}
		}
		
		if( triggerOnInit === true ) {
			ev.callback.call( ev.ctx, {
				triggeredOnInit: true
			});
		}
		
		return this;
	},
	
	/** 
	 * @method Matreshka#once
	 * @summary Attaches an event handler to the self. A handler is executed at most once.
	 * @todo Refactoring
	 * @desc Works similar to {@link Matreshka#on} method but a handler could be executed only once.
	 * Pay attention that this method doesn't have <code>triggerOnInit</code> argument.
	 * @param {eventNames} names - Space-delimited list of event names (e.g. <code>"change:x ajaxcomplete change:y"</code>)
	 * @param {eventHandler} callback - A function to execute when the event is triggered
	 * @param {object} [context] - An object to use as <code>this</code>when executing <code>callback</code>
	 * @returns {mk} self
	 * @example
	 * this.once( 'change:x', function() {
	 *   alert( 'x is changed' );
	 * });
	 * this.x = Math.random(); // alerts 'x is changed'
	 * this.x = Math.random(); // does nothing
	 */
	once: function ( names, callback, context ) {
		if( !callback ) throw Error( 'callback is not function for event "'+names+'"' );
		var _this = this,
			_once = function(func) {
				var ran = false, memo;
				return function() {
					if (ran) return memo;
					ran = true;
					memo = func.apply(this, arguments);
					func = null;
					return memo;
				};
			};
			
		names = names.split( /\s/ );
		
		for( var i = 0; i < names.length; i++ ) {
			( function( name ) {
				var once = _once(function () {
					_this.off( name, once );
					callback.apply(this, arguments);
				});
				once._callback = callback;
				_this.on( name, once, context ) ;
			})( names[ i ] );
		}
		
		return this;
	},
	
	/**
	 * @method Matreshka#off
	 * @summary Removes all event handlers from Matreshka instance of given events
	 * @desc If you no longer need some event or few events, you can remove them by passing event names as first argument to the {@link Matreshka#off} method.
	 * You can specify the callback and given context for the events that you want to remove and you can pass nothing to remove all events.
	 * @param {eventNames} [names] - Space-delimited list of event names (e.g. <code>"change:x ajaxcomplete change:y"</code>)
	 * @param {eventHandler} [callback] - A function that has been passed to {@link Matreshka#on}
	 * @param {object} [context] - An object that used as <code>this</code> when executing <code>callback</code>
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.off( 'change:x bind' );
	 * @example <caption>Remove all events</caption>
	 * this.off();
	 * @example <caption>Remove event with given event handler</caption>
	 * var handler = function() { 
	 * 	//...
	 * }
	 * this.on( 'change:x', handler );
	 * this.off( 'change:x', handler );
	 * @example <caption>Remove event with given event handler and given context</caption>
	 * var object = {};
	 * this.on( 'change:x', handler, object );
	 * this.off( 'change:x', handler, object );
	 */
	off: function (names, callback, context) {
		var retain, ev, events, names, i, l, j, k, domEvt, domEvtName, domEvtKey, indexOfET;
		
		if (!names && !callback && !context) {
			this.events = {};
			return this;
		}
		names = names.split( /\s/ );
		for (i = 0, l = names.length; i < l; i++) {
			name = names[i];
			indexOfET = name.indexOf( '@' );
			if( ~indexOfET ) {
				 ( function( key, name ) {
					if( callback ) {
						this.off( 'change:' + key, callback, context );
					} else {
						events = this.__events[ 'change:' + key ] || [];
						for( var i = 0; i < events.length; i++ ) {
							if( events[ i ].xtra === name ) {
								this.off( 'change:' + key, events[ i ].callback );
							}
						}
					}
					
					if( this[ key ] && this[ key ].isMK ) {
						this[ key ].off( name, callback, context );
					}
				}).call( this, name.slice( 0, indexOfET ), name.slice( indexOfET + 1 ) );
			} else if (events = this.__events[name]) {
				this.__events[name] = retain = [];//alert(name);
				if (callback || context) {
					for (j = 0, k = events.length; j < k; j++) {
						ev = events[j];//alert( callback === ev.callback._callback )
						if ((callback && callback !== ev.callback && callback !== ev.callback._callback) || (context && context !== ev.context)) {
							retain.push(ev);
						}
					}
				}
				if (!retain.length) delete this.__events[name];
				
				domEvt = names[ i ].split( '::' );
				domEvtName = domEvt[ 0 ];
				domEvtKey = domEvt[ 1 ]; 
				if( domEvtKey && this.__special[ domEvtKey ] ) {
					this.__special[ domEvtKey ].elements.off( domEvtName + '.' + this.__id + domEvtKey );
				}
			}
		}
		
		return this;
	},
	
	/**
	 * @method Matreshka#trigger
	 * @summary Trigger callbacks (event handlers) for the given event, or space-delimited list of events. Subsequent arguments to trigger will be passed along to the event callbacks.
	 * @desc After attaching event using {@link Matreshka#on} or {@link Matreshka#once} you can trigger it by {@link Matreshka#trigger} method and pass needed arguments to event handler using subsequent arguments.
	 * You can bind <code>"all"</code> event to catch any event triggering.
	 * @param {eventNames} [names] - Space-delimited list of event names that you want to trigger
	 * @param {...*} [arg] - Arguments that you wish to pass to the event handler
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.on( 'somethingchanged ohyeah', function( a, b, c ) {
	 * 	alert( 1 + 2 + 3 );
	 * });
	 * this.trigger( 'ohyeah', 1, 2, 3 ); // alerts 6
	 */
	trigger: function (names, arg) {
		var args = Array.prototype.slice.call(arguments, 1),
			silentAllEvent = args[ 0 ] && args[ 0 ].silentAllEvent,
			events,
			allEvents = this.__events.all,
			triggerEvents = function(events, args) {
				var ev, i = -1, l = events.length;
				while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args || []);
			};
			
		if( names ) {
			names = names.split( /\s/ );
			
			for( var i = 0; i < names.length; i++ ) {
				events = this.__events[names[i]];
				if (events) triggerEvents(events, args);
			}
		}
		
		if (allEvents && !silentAllEvent) triggerEvents(allEvents, args);
		
		return this;
	},
	
	/**
	 * @private
	 * @method Matreshka#lookForBinder
	 * @desc Returns options (defined in MK.defaultBinders: setValue, getValue, on) that matches given element
	 * @param {Node} el
	 * @returns {Object} properties
	 */
	lookForBinder: function( el ) {
		var result,
			ep = MK.defaultBinders;
		for( var i = 0; i < ep.length; i++ ) {
			if( result = ep[ i ].call( el, el ) ) {
				return result;
			}
		}
		return {};
	},
	
	/**
	 * @method Matreshka#bindElement
	 * @variation 1
	 * @fires bind
	 * @summary Creates event bridge between DOM node and Matreshka instance property
	 * @desc This powerful function binds element to instance property with given options that say when and how to extract element's value, how to set element's value when property is changed.
	 * 
	 * @param {(string|mk)} key - A key (or space-delimited list keys) that has to be binded to given element(s)
	 * @param {(Node[]|NodeList|Node|jQuery|balalaika|string)} el - An element (DOM Node or DOM NodeList or array of nodes or balalaika array or jQuery instance or css selector...) that has to be binded to given key(s)
	 * @param {binder} [binder] - A binder object which contains following properties: setValue (how to set value for an element), getValue (how to extract value from an element), on (when we have to extract a value from an element and assign it to given property)
	 * @param {eventOptions} [evtOpts] - If you want to set <code>"silent"</code> flag or pass some options to a <code>"bind"</code> event handler
	 * 
	 * @returns {mk} self
	 * 
	 * @example <caption>Basic usage 1</caption>
	 * this.bindElement( 'myKey', 'input[type="checkbox"]', {
	 * 	on: 'click',
	 * 	getValue: function() {
	 * 		return this.checked; // "this" is checkbox element  
	 * 	},
	 * 	setValue: function( v ) {
	 * 		this.checked = !!v;
	 * 	}
	 * });
	 * // now when element is binded you can change myKey and look at changes in UI
	 * this.myKey = true; // makes checkbox checked
	 * this.myKey = false; // makes checkbox unchecked
	 * 
	 * @example <caption>Basic usage 2. By {@link Matreshka.defaultBinders} array that contains binder for few dom elements (<code>input[type="text"]</code>, <code>input[type="radio"]</code>, <code>input[type="checkbox"]</code>, <code>select</code>, <code>textarea</code>). So you don't need to pass eventOptions for these elements</caption>
	 * this.bindElement( 'myKey', '.checkbox' );
	 * 
	 * @example <caption>Custom checkbox 1. This example Shows how to create your own custom checkbox that has <code>"checked"</code> class if it's state is checked.</caption>
	 * this.bindElement( 'myKey', '.custom-checkbox', {
	 * 	on: 'click',
	 * 	getValue: function() {
	 * 		return $( this ).hasClass( 'checked' );
	 * 	},
	 * 	setValue: function( v ) {
	 * 		$( this ).toggleClass( 'checked', !!v );
	 * 	}
	 * });
	 * 
	 * @example <caption>Custom checkbox 2. In this example we'll do the same as in previous example but using predefined binder via {@link Matreshka.defaultBinders}.</caption>
	 * //shift means that we're adding new default binder to the beginning of MK.defaultBinders list
	 * MK.defaultBinders.shift( function( element ) {
	 * 	if( $( element ).hasClass( 'custom-checkbox' ) ) return {
	 * 		on: 'click',
	 * 		getValue: function() {
	 * 			return $( this ).hasClass( 'checked' );
	 * 		},
	 * 		setValue: function( v ) {
	 * 			$( this ).toggleClass( 'checked', !!v );
	 * 		}
	 * 	};
	 * 	})
	 * this.bindElement( 'myKey', '.custom-checkbox' );
	 * 
	 * @example <caption>Use <code>"bind"</code> event</caption>
	 * this.on( 'bind:myKey', function() { alert( 'ok!' ); });
	 * this.bindElement( 'myKey', '.custom-checkbox' ); // alerts "ok!"
	 * 
	 * @example <caption>Use <code>"bind"</code> event options</caption>
	 * this.on( 'bind:myKey', function() { alert( 'ok!' ); });
	 * this.bindElement( 'myKey', '.custom-checkbox', {}, { silent: true } ); // no alert
	 * 
	 * @example <caption>Extending default binders. For example we're working with <code>input[type="text"]</code>. By default <code>"on"</code> property for this element contains <code>"keydown"</code> string. But we want to use <code>"blur"</code> event for the element that has been bound to <code>myKey</code> property</caption>
	 * this.bindElement( 'myKey', '.custom-checkbox', { on: "blur" });
	 * 
	 * @example <caption>Bind self to the element. If you want to use context (sandbox) for binding of elements contained in single element, you can pass <code>this</code> special property to the method</caption>
	 * // you can use this.bindElement( '__this__', '.app' ); instead
	 * this.bindElement( this, '.app' );
	 * // this.$( '.my-element' ) takes element(s) from .app
	 * this.bindElement( 'myKey', this.$( '.my-element' ) );
	 */
	
	/**
	 * @method Matreshka#bindElement
	 * @variation 2
	 * @summary Object alternative
	 * @desc {@link Matreshka#bindElement} accepts key-element use case if you have many bindings.
	 * 
	 * @param {object} keyElementPairs
	 * @param {binder} [binder] - (see above)
	 * @param {eventOptions} [evtOpts] - (see above)
	 * 
	 * @example <caption>Basic usage</caption>
	 * this.bindElement({
	 * 	myKey1: '.custom-checkbox',
	 * 	myKey2: 'textarea'
	 * });
	 */
	
	/**
	 * @method Matreshka#bindElement
	 * @variation 3
	 * @summary Many options alternative
	 * @desc {@link Matreshka#bindElement} accepts one more way how to pass <code>key, element, binder</code> to the method. It looks ugly but helps when you want to memorize special bindings that you going to kill later using {@link Matreshka#unbindElement}.
	 * 
	 * @param {Array[]} setOfArguments - (see example)
	 * @param {eventOptions} [evtOpts] - (see above)
	 * 
	 * @example <caption>Basic usage</caption>
	 * this.bindElement([
	 * 	[{
	 * 		myKey1: '.my-element1',
	 * 		myKey2: '.my-element2'
	 * 	}],
	 * 	[{
	 * 		myKey3: '.my-element3',
	 * 		myKey4: '.my-element4'
	 * 	}, {
	 * 		on: 'click',
	 * 		getValue: function() { ... },
	 * 		setValue: function() { ... }
	 * 	}],
	 * 	[{
	 * 		myKey5: '.my-element5',
	 * 		myKey6: '.my-element6'
	 * 	}, {
	 * 		on: 'somethingelse',
	 * 		getValue: function() { ... },
	 * 		setValue: function() { ... }
	 * 	}]
	 * ]);
	 */
	bindElement: function( key, el, binder, evtOpts ) {
		var _this = this,
			$el,
			keys,
			i,
			keyInThis = key in this;
		
		/*
		 * this.bindElement(this, el, ...);
		 */
		if( this.eq( key ) ) {
			key = '__this__';
		}
		
		/*
		 * this.bindElement([['key', $(), {on:'evt'}], [{key: $(), {on: 'evt'}}]], { silent: true });
		 */
		if( key instanceof Array ) {
			for( i = 0; i < key.length; i++ ) {
				this.bindElement( key[ i ][ 0 ], key[ i ][ 1 ], key[ i ][ 2 ] || evtOpts, el );
			}
			
			return this;
		}
		
		
		
		/*
		 * this.bindElement('key1 key2', el, binder, { silent: true });
		 */
		if( typeof key === 'string' ) {
			keys = key.split( /\s/ );
			if( keys.length > 1 ) {
				for( i = 0; i < keys.length; i++ ) {
					this.bindElement( keys[ i ], el, binder, evtOpts );
				}
				return this;
			}
		}
		
		
		/*
		 * this.bindElement({ key: $() }, { on: 'evt' }, { silent: true });
		 */		
		if( typeof key === 'object' ) {
			for( i in key ) if( key.hasOwnProperty( i ) ) {
				this.bindElement( i, key[ i ], el, binder );
			}
			return this;
		}
		
		this.makeSpecial( key );
		
		$el = $( el );
		
		if( !$el.length ) {
			warn( 'Bound Element is missing for key "'+key+'"' );
			return this;
		}
		
		this.__special[ key ].elements = this.__special[ key ].elements.add( $el );
		
		MK.each( $el, function( el ) {
			var _binder = binder !== null ? extend( key === '__this__' ? {} : _this.lookForBinder( el ), binder ) : {},
				options = {
					self: _this,
					key: key,
					elements: $el,
					element: el
				},
				mkHandler;
				
			if( _binder.initialize ) {
				_binder.initialize.call( el, options );
			}
			
			if( _binder.setValue ) {
				mkHandler = function( evt ) {
					var v = _this[ key ];
					_binder.setValue.call( el, v, extend( { value: v }, options ) );
				};
				_this.on( '_change:' + key, mkHandler );
				if( !keyInThis && _binder.getValue ) {
					_this.__special[ key ].value = _binder.getValue.call( el, options );
				} else if( keyInThis ) {
					mkHandler();
				}
			}
			
			if( _binder.getValue && _binder.on ) {
				domEventsMap.add({
					el: el,
					on: _binder.on,
					instance: _this,
					key: key,
					mkHandler: mkHandler,
					handler: function( event ) {
						var oldvalue = _this[ key ],
							value = _binder.getValue.call( el, extend( { value: oldvalue, event: event }, options ) );
						if( value !== oldvalue ) {
							_this.set( key, value, {
								fromElement: true
							});
						}
					}
				});
			}			
		});
		
		if( !evtOpts || !evtOpts.silent ) {
			this.trigger( 'bind:' + key, extend({
				key: key,
				elements: $el,
				element: $el[ 0 ] || null
			}, evtOpts ) );
		}
		
		return this;
	},
	
	/**
	 * @method Matreshka#unbindElement
	 * @fires unbind
	 * @variation 1
	 * @summary Unbinds element from given property
	 * @desc If you no longer need a bridge between element and Matreshka property you can remove it by this method.
	 * @param {string|null} key - A key (or space-delimited list keys) that has to be unbinded from given element(s) (null if you want to unbind element(s) from any key of instance)
	 * @param {(Node[]|NodeList|Node|jQuery|balalaika|string)} [el]- An element (DOM Node or DOM NodeList or array of nodes or jQuery instance or css selector) that has to be unbinded from given key(s)
	 * @param {eventOptions} [evtOpts] - If you want to set "silent" flag or pass some options to "unbind" event handler
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.bindElement( 'myKey', '.my-element' );
	 * this.myKey = true; // changes myKey property and element state
	 * this.unbindElement( 'myKey', '.my-element' );
	 * this.myKey = false; // changes property only
	 */
	
	/**
	 * @method Matreshka#unbindElement
	 * @variation 2
	 * @summary Unbinds element(s) from given properties contained in key-element object
	 * @param {object} keyElementPairs (see example)
	 * @param {(Node[]|NodeList|Node|jQuery|balalaika|string)} [el]
	 * @param {eventOptions} [evtOpts] (see above)
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.unbindElement({
	 *	myKey1: '.my-element1' 
	 *	myKey1: '.my-element2' 
	 * });
	 */
	
	/**
	 * @method Matreshka#unbindElement
	 * @variation 3
	 * @summary Unbinds elements that passed to big ugly array (see {@link Matreshka#bindElement})
	 * @param {array[]} setOfArguments (see example)
	 * @param {eventOptions} [evtOpts] (see above)
	 * @returns {mk} self
	 *  @example <caption>Basic usage</caption>
	 * var temporaryBindings = [
	 * 	[{
	 * 		myKey1: '.my-element1'
	 * 		myKey2: '.my-element2'
	 * 	}],
	 * 	[{
	 * 		myKey3: '.my-element3'
	 * 		myKey4: '.my-element4'
	 * 	}, {
	 * 		on: 'click',
	 * 		getValue: function() { ... },
	 * 		setValue: function() { ... }
	 * 	}],
	 * 	[{
	 * 		myKey5: '.my-element5'
	 * 		myKey6: '.my-element6'
	 * 	}, {
	 * 		on: 'somethingelse',
	 * 		getValue: function() { ... },
	 * 		setValue: function() { ... }
	 * 	}]
	 * ]
	 * this.bindElement( temporaryBindings );
	 * 
	 * // you no longer want to have these bindings
	 * this.unbindElement( temporaryBindings );
	 */
	
	unbindElement: function( key, el, evtOpts ) {
		var $el,
			keys,
			evts = domEventsMap[ this.__id ];
		
		if( !evts ) return this;
			
		if( this.eq( key ) ) {
			key = '__this__';
		}
		
		if( key instanceof Array ) {
			for( var i = 0; i < key.length; i++ ) {
				evtOpts = el;
				this.unbindElement( key[ i ][ 0 ], key[ i ][ 1 ] || evtOpts, evtOpts );
			}
			
			return this;
		}
		
		if( typeof key === 'string' ) {
			keys = key.split( /\s/ );
			if( keys.length > 1 ) {
				for( i = 0; i < keys.length; i++ ) {
					this.unbindElement( keys[ i ], el, evtOpts );
				}
				return this;
			}
		}
		
		
		if( typeof key === 'object' && key !== null ) {
			for( var i in key ) if( key.hasOwnProperty( i ) ) {
				this.unbindElement( i, key[ i ], el );
			}
			return this;
		} else if( key === null ) {
			for( key in this.__special ) if( this.__special.hasOwnProperty( key ) ){
				this.unbindElement( key, el, evtOpts );
			}
			return this;
		} else if( !el ) {
			if( this.__special[ key ] && this.__special[ key ].elements ) {
				return this.unbindElement( key, this.__special[ key ].elements, evtOpts );
			} else {
				return this;
			}
		}
		
		$el = $( el );
		
		MK.each( $el, function( el, i ) {
			domEventsMap.rem({
				el: el,
				instance: this
			});
			
			/*var evts = $._data( el, 'events' );
			MK.each( evts, function( evt, evtName ) {
				var mk;
				for( var i = 0; i < evt.length; i++ ) {
					if( evt[ i ].namespace === 'mk' && 'mk' in evt[ i ].data && this.eq( evt[ i ].data.mk.instance) ) {
						mk = evt[ i ].data.mk;
						this.off( '_change:' + mk.key, mk.mkHandler );
						// @question can I remove an element from event array: evt.splice( i--, 1 );? It works but I'm not sure is this good idea.
						$( el ).off( evtName + '.mk', evt[ i ].handler );
					}
				}
			}, this )*/
		}, this );
		
		if( !evtOpts || !evtOpts.silent ) {
			this.trigger( 'unbind:' + key, extend({
				key: key,
				elements: $el,
				element: $el[ 0 ] || null
			}, evtOpts ) );
		}
		
		return this;
	},
	
	/**
	 * @method Matreshka#boundAll
	 * @summary Returns elements wrapped with jQuery or balalaika that bound to given property 
	 * @desc After you bound elements to a property you can extract them by using this method.
	 * @param {string} [key] - For which key we want to extract elements. If undefined or null returns elements bound to <code>this</code>.
	 * @returns {(jQuery|balalaika)} Bound elements
	 * 
	 * @example <caption>Basic usage</caption>
	 * this.bindElement( 'myKey', '.my-element' );
	 * this.boundAll( 'myKey' ); // returns $( '.my-element' )
	 * @example <caption>Get element bound to <code>this</code></caption>
	 * this.bindElement( this, '.app' );
	 * this.boundAll(); // returns $( '.app' )
	 */
	boundAll: function( key ) {
		var __special = this.__special,
			keys, $el;
		key = key === this || !key ? '__this__' : key;
		keys = typeof key === 'string' ? key.split( /\s/ ) : key;
		if( keys.length <= 1 ) {
			return keys[ 0 ] in __special ? __special[ keys[ 0 ] ].elements : $();
		} else {
			$el = $();
			for( var i = 0; i < keys.length; i++ ) {
				$el = $el.add( __special[ keys[ i ] ].elements );
			}
			return $el;
		}
	},
	
	/**
	 * @method Matreshka#bound
	 * @summary Returns first bound element
	 * @param {string} [key] - For which key we want to extract single element. If undefined or null returns element bound to <code>this</code>.
	 * @returns {(Node|null)} Bound element
	 * @example <caption>Basic usage</caption>
	 * this.bindElement( 'myKey', '.my-element' );
	 * this.bound( 'mykey' ); // returns $( '.my-element' )[0]
	 * @example <caption>Get element bound to <code>this</code></caption>
	 * this.bindElement( this, '.app' );
	 * this.bound(); // returns $( '.app' )[0]
	 */
	bound: function( key ) {
		var __special = this.__special,
			keys;
		key = key === this || !key ? '__this__' : key;
		keys = typeof key === 'string' ? key.split( /\s/ ) : key;
		if( keys.length <= 1 ) {
			return keys[ 0 ] in __special ? __special[ keys[ 0 ] ].elements[ 0 ]  : null;
		} else {
			for( var i = 0; i < keys.length; i++ ) {
				if( keys[ i ] in __special && __special[ keys[ i ] ].elements.length ) {
					return __special[ keys[ i ] ].elements[ 0 ];
				}
			}
		}
		
		return null;
	},
	
	/**
	 * @method Matreshka#$el
	 * @deprecated since 0.1. Use Matreshka#boundAll method instead
	 */
	$el: function( key ) {
		warnDeprecated( '#$el', '#boundAll' );
		return this.boundAll( key );
	},
	
	/**
	 * @method Matreshka#el
	 * @deprecated since 0.1. Use Matreshka#bound method instead
	 */
	el: function( key ) {
		warnDeprecated( '#el', '#bound' );
		return this.bound( key );
	},
	
	/**
	 * @method Matreshka#selectAll
	 * @summary Finds elements that contained in element that bound to <code>this</code>
	 * @desc After you bind element to <code>this ("__this__")</code> you can use this method for finding elements that contained in bound element.
	 * @param {string} selector
	 * @returns {(jQuery|balalaika)}
	 * @example <caption>Basic usage</caption>
	 * this.bindElement( this, '.app' );
	 * this.selectAll( '.my-element' );
	 * // equals to
	 * this.boundAll().find( '.my-element' );
	 * // equals to
	 * $( '.app' ).find( '.my-element' );
	 */
	selectAll: function( s ) {
		return this.boundAll().find( s );
	},
	
	/**
	 * @method Matreshka#$
	 * @summary Works similar to {@link Matreshka#selectAll}
	 */
	$: function( s ) {
		return this.selectAll( s );
	},
	
	/**
	 * @method Matreshka#select
	 * @summary Finds first element that contained in element that bound to <code>this</code>
	 * @desc After you bind element to <code>this ("__this__")</code> you can use this method for finding element that contained in bound element.
	 * @param {string} selector
	 * @returns {(jQuery|balalaika)}
	 * @example <caption>Basic usage</caption>
	 * this.bindElement( this, '.app' );
	 * this.select( '.my-element' );
	 * // equals to
	 * this.bound().querySelector( '.my-element' );
	 * // equals to
	 * $( '.app' ).find( '.my-element' )[ 0 ];
	 */
	select: function( s ) {
		var bound = this.bound();
		return bound && bound.querySelector( s );
	},
	
	/**
	 * @private
	 * @method Matreshka#makeSpecial
	 * @todo create docs
	 */
	makeSpecial: function( key ) {
		var specialProps = this.__special[ key ];
		if( !specialProps ) {
			specialProps = this.__special[ key ] = {
				elements: $(),
				value: this[ key ],
				getter: function() { return specialProps.value; },
				setter: function( v ) {
					this.set( key, v, {
						fromSetter: true
					});
				},
				mediator: null
			};
			Object.defineProperty( this, key, {
				configurable: true,
				get: function() {
					return specialProps.getter.call( this );
				},
				set: function( v ) {
					specialProps.setter.call( this, v );
				}
			});
		}
		
		return specialProps;
	},
	
	/**
	 * @method Matreshka#eq
	 * @since 0.0.2
	 * @summary Checks is instance equals to given object
	 * @desc The IE8 throws an exception when you're trying to check equality of two Matreshka instances. Use <code>.eq</code> method instead of <code>==</code> and <code>===</code>
	 * @param {object} object - An object that you wish to test for equality with 
	 * @example <caption>IE8 issue</caption>
	 * this === object; //sometimes IE8 throws "Class doesn't support Automation"
	 * @example <caption>Basic usage</caption>
	 * this.eq( object ); // true or false
	 */
	eq: function( object ) { // @IE8
		return typeof object === 'object' && object !== null && this.__id === object.__id;
	},
	
	/**
	 * @method Matreshka#defineGetter
	 * @variation 1
	 * @summary Defines getter for given property
	 * @desc This method makes possible to create custom getter using Object.defineProperty. 
	 * @param {string} key - A key for which you want to customize getter
	 * @param {function} getter - Your getter
	 * @example <caption>Basic usage</caption>
	 * this.defineGetter( 'mykey', function() {
	 * 	return 42; // you can pass any computed value 
	 * });
	 */
	
	/**
	 * @method Matreshka#defineGetter
	 * @variation 2
	 * @summary Defines getter using key-getter pairs object
	 * @param {object} keyGetterPairs (see example)
	 * @example <caption>Basic usage</caption>
	 * this.defineGetter({
	 * 	myKey1: function() { return 1; } 
	 * 	myKey2: function() { return 2; } 
	 * });
	 */
	defineGetter: function( key, getter ) {
		if( typeof key === 'object' ) {
			for( var i in key ) if( key.hasOwnProperty( i ) ) {
				this.defineGetter( i, key[ i ] );
			}
			return this;
		}
		
		var __special = this.makeSpecial( key );
		__special.getter = function() {
			return getter.call( this, {
				value: __special.value,
				key: key,
				self: this
			});
		}.bind( this );
		
		return this;
	},
	
	/**
	 * @method Matreshka#defineSetter
	 * @variation 1
	 * @summary Defines setter for given property
	 * @desc This method makes possible to attach custom setter using Object.defineProperty. Pay attention that your setter overrides Matreshka's setter and <code>change</code> events wil not be triggered on given property. Use this method only if you know what do you do, otherwise look at {@link Matreshka#on} and {@link Matreshka#setMediator} methods.
	 * @param {string} key - A key for which you want to customize setter
	 * @param {function} setter - Your setter
	 * @example <caption>Basic usage</caption>
	 * this.defineSetter( 'mykey', function( v ) {
	 * 	alert( v );
	 * });
	 */
	
	/**
	 * @method Matreshka#defineSetter
	 * @variation 2
	 * @summary Defines getter using key-setter pairs object
	 * @param {object} keySetterPairs (see example)
	 * @example <caption>Basic usage</caption>
	 * this.defineSetter({
	 * 	myKey1: function( v ) { alert( v ); } 
	 * 	myKey2: function( v ) { alert( v ); } 
	 * });
	 */
	defineSetter: function( key, setter ) {
		if( typeof key === 'object' ) {
			for( var i in key ) if( key.hasOwnProperty( i ) ) {
				this.defineSetter( i, key[ i ] );
			}
			return this;
		}
		
		this.makeSpecial( key ).setter = function( v ) {
			return setter.call( this, v, {
				value: v,
				key: key,
				self: this
			});
		}.bind( this );
		
		return this;
	},
	
	/**
	 * @method Matreshka#setMediator
	 * @variation 1
	 * @since 0.1
	 * @summary Transforms property
	 * @desc This method is using when you want to keep your property to be a certain type (string, number, object...).
	 * @example
	 * this.setMediator( 'x', function() { return String( s ); } );
	 * this.x = 1;
	 * alert( typeof this.x ); // "string"
	 */
	/**
	 * @method Matreshka#setMediator
	 * @variation 2
	 * @since 0.1
	 * @summary Does same as described above but accepts key-mediator object
	 * @example
	 * this.setMediator({
	 * 	x: String,
	 * 	y: parseInt
	 * });
	 * this.x = 1;
	 * this.y = '12345.678';
	 * alert( typeof this.x ); // "string"
	 * alert( typeof this.y ); // "number"
	 * alert( this.y ); // 12345
	 */
	setMediator: function( key, mediator ) {
		if( typeof key === 'object' ) {
			for( var i in key ) if( key.hasOwnProperty( i ) ) {
				this.setMediator( i, key[ i ] );
			}
			return this;
		}
		
		var __special = this.makeSpecial( key );
		
		__special.mediator = function( v ) {
			return mediator.call( this, v, __special.value, key, this );
		}.bind( this );
		
		__special.value = __special.mediator( __special.value );
		
		return this;
	},
	
	/**
	 * @method Matreshka#addDependency
	 * @since 0.1
	 * @summary Defines smart getter
	 * @desc {@link Matreshka#addDependency} adds dependence of <code>key</code> from <code>keys</code>. You can use it instead of {@link Matreshka#defineGetter} if you want to listen change:*key* event for given key or bind key to an element)
	 * @param {string} key - what depends on
	 * @param {string|string[]} keys - depends from
	 * @param {function} [getter=function(value){return value;}] - how depends (should return value)
	 * @param {boolean} [setOnInit=true]
	 * @example <caption>Basic usage</caption>
	 * this.a = 3;
	 * this.b = 4;
	 * this.addDependency( 'perimeter', 'a b', function() { return ( this.a + this.b ) * 2} );
	 * alert( this.perimeter ); // 14
	 * this.on( 'change:perimeter', function() {
	 * 	alert( 'perimeter is changed to ' + this.perimeter );
	 * });
	 * this.a = 5; // alerts "perimeter is changed to 18"
	 */
	
	addDependency: function( key, keys, getter, setOnInit ) {
		var keys = typeof keys === 'string' ? keys.split( /\s/ ) : keys,
			on_Change = function( evt ) {
				var values = [];

				if( typeof keys[ 0 ] === 'object' ) {
					for( var i = 0; i < keys.length; i += 2 ) {
						_this = keys[ i ];
						_key = keys[ i + 1 ];
						values.push( _this[ _key ] );
					}
				} else {
					for( var i = 0; i < keys.length; i++ ) {
						_key = keys[ i ];
						_this = this;
						this.makeSpecial( _key );
						values.push( _this[ _key ] );
					}
				}
				
				this.set( key, getter.apply( this, values ), {
					silent: evt && evt.silentChangeEvent
				});
			},
			_this, _key;
		getter = getter || function( value ) { return value; };
		
		
		if( typeof keys[ 0 ] === 'object' ) {
			for( var i = 0; i < keys.length; i += 2 ) {
				_this = keys[ i ];
				_key = keys[ i + 1 ];
				_this.makeSpecial( _key );
				_this.on( '_change:' + _key, on_Change, this );
			}
		} else {
			for( var i = 0; i < keys.length; i++ ) {
				_key = keys[ i ];
				_this = this;
				_this.makeSpecial( _key );
				_this.on( '_change:' + _key, on_Change, this );
			}
		}
		
		setOnInit !== false && on_Change.call( this );
		
		/*for( var i = 0; i < keys.length; i++ ) {
			if( typeof keys[ i ] === 'object' && keys[ i ][ 0 ].isMK ) {
				_this = keys[ i ][ 0 ];
				_key = keys[ i ][ 1 ];
			} else {
				_this = this;
				_key = keys[ i ];
			}
			_this.makeSpecial( _key );
			_this.on( '_change:' + _key, on_Change, this );
			
			setOnInit !== false && on_Change.call( this );
		}*/
		
		return this;
	},
	
	/**
	 * @method Matreshka#addDependence
	 * @deprecated since 0.2. This property is renamed. Use {@link Matreshka#addDependency} instead
	 */
	addDependence: function() {
		warnDeprecated( '#addDependence', '#addDependency' );
		return this.addDependency.apply( this, arguments );
	},
	
	/**
	 * @method Matreshka#get
	 * @summary Just returns given property (or value returned by getter)
	 * @param {string} key
	 * @example <caption>Basic usage</caption>
	 * this.get( 'myKey' ); // equals to this[ 'myKey' ] or this.myKey
	 */
	get: function( key ) {
		return this[ key ];
	},
	
	/**
	 * @method Matreshka#set
	 * @fires change
	 * @fires change:*key*
	 * @variation 1
	 * @summary Sets value for given property 
	 * @desc Sets value for given property and gives possibility to pass event object (with <code>"silent"</code> property if you added <code>change:*key*</code> event in a past or other data).
	 * @param {string} key
	 * @param {*} value
	 * @param {eventOptions} [evtOpts]
	 * @example <caption>Basic usage</caption>
	 * this.on( 'change:myKey', function( evtOpts ) {
	 * 	alert( evtOpts.value );
	 * });
	 * this.set( 'myKey', 3 ); // equals to this[ 'myKey' ] = 3 or this.myKey = 3, alerts 3
	 * @example <caption>Passing <code>eventOptions</code></caption>
	 * // no alert
	 * this.set( 'myKey', 4, {
	 * 	silent: true
	 * });
	 * // alerts 5, evtOpts (first event handler argument) contains property myFlag
	 * this.set( 'myKey', 5, { 
	 * 	myFlag: 'Jigurda'
	 * });
	 */
	/**
	 * @method Matreshka#set
	 * @variation 2
	 * @summary You can use key-value pairs object if you want to set few properties at once
	 * @param {object} keyValuePairs
	 * @param {eventOptions} [evtOpts]
	 * @example <caption>Basic usage</caption>
	 * this.set({
	 * 	myKey1: 1,
	 * 	myKey2: 2
	 * });
	 * @example <caption>Passing <code>eventOptions</code></caption>
	 * this.set({
	 * 		myKey: 3
	 * 	}, {
	 * 		myFlag: 'Jigurda'
	 * });
	 */
	set: function( key, v, evtOpts ) {
		if( typeof key === 'undefined' ) return this;
		
		if( typeof key === 'object' && key !== this ) {
			for( var i in key ) if( key.hasOwnProperty( i ) ) {
				this.set( i, key[ i ], v );
			}
			return this;
		}
		if( !this.__special || !this.__special[ key ] ) {
			this[ key ] = v;
			return this;
		}
		var special = this.__special[ key ],
			prevVal = special.value,
			evtObject, newV;
		
		evtOpts = evtOpts || {};
		
		if( special.mediator && v !== prevVal && !evtOpts.skipMediator ) {
			newV = special.mediator.call( this, v, prevVal, key, this );
		} else {
			newV = v;
		}
		
		special.value = newV;
		
		if( newV !== v && !Number.isNaN( newV ) ) {
			this.set( key, newV, {
				silent: true,
				forceHTML: true,
				skipMediator: true
			});
		}
		
		if( newV !== prevVal || evtOpts.force || evtOpts.forceHTML ) {
			this.trigger( '_change:' + key, { // using for changing element state
				silentAllEvent: true,
				silentChangeEvent: evtOpts.silent || newV === prevVal // TODO WTF Flag. Rename it!
			});
		}
		
		if( ( newV !== prevVal || evtOpts.force ) && !evtOpts.silent ) {
			evtObject = extend({
				value: newV,
				previousValue: prevVal,
				key: key,
				element: special.elements[ 0 ] || null,
				elements: special.elements,
				self: this
			}, evtOpts );
			
			this
				.trigger( 'change:' + key, evtObject )
				.trigger( 'change', evtObject )
			;
		}
		
		return this;
	},
	
	/**
	 * @method Matreshka#remove
	 * @fires delete
	 * @fires delete:*key*
	 * @summary Removes property from {@link Matreshka} instance
	 * @param {string} key - A key (or space-delimited list of keys) that you want to remove from current instance
	 * @param {eventOptions} [evtOptions]
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.remove( 'myKey' );
	 * this.remove( 'myKey1 myKey2' );
	 * @example <caption>Using <code>eventOptions</code></caption>
	 * this.remove( 'myKey', { silent: true } );
	 */
	remove: function( key, evtOpts ) {
		var exists,
			keys = String( key ).split( /\s/ );
			
		evtOpts = extend({
			keys: keys
		}, evtOpts );
		
		for( var i = 0; i < keys.length; i++ ) {
			exists = keys[ i ] in this;
			if( exists ) {
				evtOpts.key = keys[ i ];
				evtOpts.value = this[ keys[ i ] ];
				
				this.unbindElement( keys[ i ] ).off( 'change:' + keys[ i ] );
				
				delete this.__special[ keys[ i ] ];
				
				try { // @IE8 fix
					delete this[ keys[ i ] ];
				} catch(e) {}
				
				if( !evtOpts || !evtOpts.silent ) {
					this
						.trigger( 'delete', evtOpts )
						.trigger( 'delete:' + keys[ i ], evtOpts )
					;
				}
			}
		}
		
		return this;
	},
	
	/**
	 * @method Matreshka#define
	 * @variation 1
	 * @summary Defines property using <code>Object.defineProperty</code>. Pay attention that <code>Object.defineProperty</code> doesn't work correctly in IE8.
	 * @param {string} key - key
	 * @param {function} descriptor - descriptor
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.define( 'myKey', {
	 * 	get: function() { ... }
	 * 	set: function() { ... }
	 * });
	 */
	/**
	 * @method Matreshka#define
	 * @variation 2
	 * @summary Defines properties passed to key-object object. Works similar to <code>Object.defineProperties</code>
	 * @param {object} keyObjectPairs
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.define({
	 * 	myKey1: {
	 * 		get: function() { ... }
	 * 		set: function() { ... }
	 * 	},
	 * 	myKey2: {
	 * 		get: function() { ... }
	 * 		set: function() { ... }
	 * 	}
	 * |);
	 */
	define: function( key, descriptor ) {
		if( typeof key === 'object' ) {
			for( var p in key ) {
				this.define( p, key[ p ] );				
			}		
			return this;
		}
		Object.defineProperty( this, key, descriptor );
		return this;
	},
	
	/**
	 * @method Matreshka#defineNotEnum
	 * @variation 1
	 * @summary Defines non-enumerable property using get-set hack for IE8
	 * @param {string} key - key
	 * @param {*} value - value
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.defineNotEnum( 'myKey', 3 );
	 */
	/**
	 * @method Matreshka#defineNotEnum
	 * @variation 2
	 * @summary Defines non-enumerable properties defined in key-value object
	 * @param {object} keyValuePairs
	 * @returns {mk} self
	 * @example <caption>Basic usage</caption>
	 * this.defineNotEnum({
	 * 	myKey1: 3,
	 * 	myKey2: 4
	 * });
	 */
	defineNotEnum: function( key, value ) {
		if( typeof key === 'object' ) {
			for( var p in key ) {
				this.defineNotEnum( p, key[ p ] );				
			}		
			return this;
		}
		
		if( MK.isXDR ) { // @IE8
			Object.defineProperty( this, key, {
				get: function() {
					return value;	
				},
				set: function( v ) {
					value = v;
				},
				configurable: true
			});
		} else {
			Object.defineProperty( this, key, {
				value: value,
				enumerable: false,
				writable: true,
				configurable: true
			});
		}
		return this;
	},
	
	/**
	 * @method Matreshka#initMK
	 * @summary Initializes Matreshka
	 * @desc This method initializes Matreshka by creating needed objects. You should call it if you inherit your own class from Matreshka.
	 * @returns {mk} self
	 * @example <caption>Usage</caption>
	 * this.initMK();
	 */
	initMK: function() {
		if( !this.isMKInitialized ) {
			this.defineNotEnum({
				/**
				* Instance id
				* @private
				* @since 0.0.2
				* @member {number}
				*/
				__id: 'mk' + new Date().getTime() + Math.random(),
				/**
				* This object contains all events
				* @private
				* @member {object}
				* @todo write documentation for __events and __special
				*/
				__events: {},
				/**
				* This object contains all special values
				* @private
				* @member {object}
				* @todo write documentation for __events and __special
				*/
				__special: {}
			});
			this.isMKInitialized = true;
		}
		
		return this;
	},
	toString: function() {
		return '[object Matreshka]'	
	},
	constructor: function() {
		this.initMK();
	}
}),

/**
 * @method Matreshka.extend
 * @summary Extends o1 object with o2
 * @prop {object} o1
 * @prop {...object} o2
 * @returns {object} o1
 * @example <caption>Usage</caption>
 * var o1 = { a: 3 },
 *     o2 = { b: 4 }
 * MK.extend( o1, o2 );
 */
extend = MK.extend = function( o1, o2 ) {
	for( var i = 1; i < arguments.length; i++ ) {
		o2 = arguments[ i ];
		for( var j in o2 ) if( o2.hasOwnProperty( j ) ) {
			o1[ j ] = o2[ j ];
		}
	}
	return o1;
};

extend( MK, {
	/**
	* @method Matreshka.Class
	* @since 0.2
	* @summary Same as {@link Class} function
	* @example
	* MK.Class({
	* 	method: function() {}
	* });
	* 
	* //does same as
	* Class({
	* 	method: function() {}
	* });
	*/
	Class: Class,
	/**
	* @method Matreshka.$
	* @summary Matreshka dom library (jQuery, Zepto, Balalaika etc)
	*/
	$: $,
	/**
	 * @method Matreshka.useBalalaika
	 * @deprecated since 0.2. Use {@link Matreshka.useAs$} method instead
	 */
	useBalalaika: function() {
		warnDeprecated( '.useBalalaika', '.useAsDOMLib' );
		MK.$ = $ = $b;
	},
	/**
	 * @method Matreshka.usejQuery
	 * @deprecated since 0.2. Use {@link Matreshka.useAsDOMLib} method instead
	 */
	usejQuery: function() {
		warnDeprecated( '.usejQuery', '.useAsDOMLib' );
		MK.$ = $ = jQuery;
	},
	/**
	 * @method Matreshka.useAs$
	 * @since 0.2
	 * @summary Use given dom library as main dom library 
	 * @param {function} $ - your favorite library (jQuery, $b etc.)
	 * @todo Convert bound element to given lib instance
	 */
	useAs$: function( _$ ) {
		return MK.$ = $ = _$;
	},
	/**
	 * @member {boolean} Matreshka.isXDR
	 * @summary Tells us are we using XDomainRequest hack. In other words, is current browser IE8.
	 */
	isXDR: Class.isXDR,
	
	/**
	 * @member {Array} Matreshka.elementProcessors
	 * @enum {function}
	 * @deprecated since 0.1. This property is renamed. Use {@link Matreshka.defaultBinders} instead
	 */
	
	/**
	 * @member {Array} Matreshka.defaultBinders
	 * @enum {function}
	 * @summary {@link Matreshka.defaultBinders} is the array of functions that compare given element by given rules and returns {@binder} if comparing is successfully. It used for defining elements behavior in {@link Matreshka#bindElement} method without passing third argument.
	 * @example <caption>HTML5 input type=number</caption>
	 * //shift means that we're adding new default binder to the beginning of MK.defaultBinders list
	 * MK.defaultBinders.shift( function( element ) {
	 * 	if( element.tagName === 'input' && element.type === 'number' ) return {
	 * 		on: 'mouseup',
	 * 		getValue: function() {
	 * 			return this.value;
	 * 		},
	 * 		setValue: function( v ) {
	 * 			this.value = v;
	 * 		}
	 * 	};
	 * });
	 * this.bindElement( 'myKey', '.my-input-type-number' );
	 *
	 * @example <caption>Custom checkbox</caption>
	 * MK.defaultBinders.shift( function( element ) {
	 * 	if( $( element ).hasClass( 'custom-checkbox' ) ) return {
	 * 		on: 'click',
	 * 		getValue: function() {
	 * 			return $( this ).hasClass( 'checked' );
	 * 		},
	 * 		setValue: function( v ) {
	 * 			$( this ).toggleClass( 'checked', !!v );
	 * 		}
	 * 	};
	 * });
	 * this.bindElement( 'myKey', '.custom-checkbox' );
	 */
	defaultBinders: MK.elementProcessors = [],
	
	/**
	 * @member {binder} Matreshka.htmlp
	 * @deprecated since 0.1. Use {@link Matreshka.binders.innerHTML} function instead
	 */
	htmlp: {
		setValue: function( v ) {
			warnDeprecated( '.htmlp', '.binders.innerHTML' );
			this.innerHTML = v === null ? '' : v;
		}
	},
	
	/**
	 * @method Matreshka.classp
	 * @since 0.0.2
	 * @deprecated since 0.1. Use {@link Matreshka.binders.className} function instead
	 */
	classp: function( className ) {
		var not = !className.indexOf( '!' );
		if( not ) {
			className = className.replace( '!', '' );
		}
		warnDeprecated( '.classp', '.binders.className' );
		return {
			setValue: function( v ) {
				$( this ).toggleClass( className, not ? !v : !!v );
			}
		};
	},

	/**
	 * @method Matreshka.noop
	 * @summary Just empty function
	 */
	noop: function() {},
	
	/**
	 * @method Matreshka.each
	 * @summary Iterates given object with given callback
	 * @param {object} o - iterable object
	 * @param {function} callback - Function to execute for each element.
	 * @param {*} [thisArg] - Object to use as <code>this</code> when executing <code>callback</code>
	 */
	each: function( o, f, thisArg ) {
		if( !o ) return;
		if( 'length' in o ) [].forEach.call( o, f, thisArg );
		else for( var i in o ) if( o.hasOwnProperty( i ) ) {
			f.call( thisArg, o[ i ], i, o );
		}
		return o;
	},
	
	/**
	 * @method Matreshka.procrastinate
	 * @summary TODO DESCRIPTION
	 * @since 0.2
	 */
	procrastinate: function ( f, d, context ) {
		var timeout;
		if( typeof d !== 'number' ) {
			context = d;
			d = 0;
		}
		return function() {
			var args = arguments,
				_this = this;
			clearTimeout( timeout );
			timeout = setTimeout( function() {
				f.apply( context || _this, args );
			}, d || 0 );
		};
	}
});

MK.defaultBinders.push( function( el ) {
	if( el.tagName === 'INPUT' && el.type === 'checkbox' ) {
		return {
			on: 'click keyup',
			getValue: function() { return this.checked; },
			setValue: function( v ) { this.checked = v; }
		};
	} else if( el.tagName === 'INPUT' && el.type === 'radio' ) {
		return {
			on: 'click keyup',
			getValue: function() { return this.value; },
			setValue: function( v ) {
				this.checked = this.value == v;
			}
		};
	} else if( el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ) {
		return {
			on: 'keyup paste',
			getValue: function() { return this.value; },
			setValue: function( v ) { this.value = v; }
		};
	} else if( el.tagName === 'SELECT' ) {
		return {
			on: 'change',
			getValue: function() { return this.value; },
			setValue: function( v ) {
				this.value = v;
				if( !v ) {
					for( var i = this.options.length - 1; i >= 0; i-- ) {
						if( this.options[ i ].value === v ) {
							this.options[ i ].selected = true;
						}
					}
				}
			}
		};
	}
});

/**
 * Event handler
 * @callback eventHandler
 * @param {...*} options - any arguments that passed to {@link Matreshka#trigger} after event name
 * @example
 * var eventHandler = function() {
 * 	console.log( arguments ); 
 * }
 * this.on( 'fyeah', eventHandler );
 * this.trigger( 'fyeah', 'foo', 'bar', 'baz' ); // logs 'foo', 'bar', 'baz'
 */
 
 /**
 * {@link Matreshka} instance
 * @typedef {object} mk
 */

/**
 * {@link $b} instance
 * @typedef {Array} balalaika
 */

 /**
 * Event name or space-delimited list of event names 
 * @typedef {string} eventNames
 * @example
 * var eventNames = 'change:a change:b fyeah done change:x'
 * this.on( eventNames, function() {} );
 */

 /**
 * <code>binder</code> contains information about how to extract value from an element, how to set value for an element and which element's event we have to listen
 * @typedef {object} binder
 * @property {string} [on] - event name (or space-delimited list of events) which we have to listen
 * @property {function} [getValue] - function that tells how to extract value from an element (context <code>this</code> is given element)
 * @property {function} [setValue] - "How to set value" for an element (context <code>this</code> is given element)
 * 
 * @example
 * var binder = {
 * 	on: 'click',
 * 	getValue: function() { return this.value; } 
 * 	setValue: function( v ) { this.value = v; } 
 * };
 * this.bindElement( 'a', '.my-checkbox', binder );
 */

/**
 * @typedef {object} eventOptions
 * @summary <code>eventOptions</code> object could contain any properties
 * @desc The one of special properties is <code>"silent"</code> that could be passed to <code>Matreshka#set</code>, <code>Matreshka#remove</code>, <code>Matreshka#bind</code>, <code>Matreshka#unbind</code> if you'd like to prevent the event from being triggered
 * 
 * @example
 * var eventOptions = { silent: true };
 * this.a = 1;
 * this.on( 'change:a', function() { alert( 'a is changed' ); });
 * this.a = 2; // no alert
 *
 * @example
 * var eventOptions = { f: 'yeah' };
 * this.a = 1;
 * this.on( 'change:a', function( eventOptions ) { alert( eventOptions.f ); });
 * this.set( 'a', 2 ); // alerts "yeah"
 */

return Matreshka;
}));