registerNameSpace("Search");

/**
 * Orquestador de la página de Búsqueda de Resultados de Hoteles.
 */

// ------------------------------------------------------
// Global Variables
// ------------------------------------------------------
var filterSelectedLogging = {};
var upaDataHf = {};
var odc;
Search.Orchestrator = (function($, undefined) {
    // ------------------------------------------------------
    // Variables
    // ------------------------------------------------------
    var _defaults = {
        quantityPassengers : 1,
        notNumericErrorMsg : "",
        invalidPriceFromErrorMsg : "",
        errorMessage : "",
        distanceSortMsg : "",
        defaultHotSpotFilterValue : null,
        defaultOrderByFilterValue : null,
        priceFromPlaceholder : "",
        priceToPlaceholder : "",
        getHsmResults : true,
        userAction : "default",
        baseLoggerDS4JUrl : "",
        standard : true,
        discountTicket : {
            hotelId : 0
        },
        resources : {
            hotelFoundIn : '',
            hotelsFoundIn : '',
            hotelAvailableIn : '',
            hotelsAvailableIn : '',
            maxCapacity : '',
            seeMoreRooms : '',
            seeFewerRooms : '',
            people : '',
            person : '',
            additionalBeds : '',
            additionalBed : ''
        },
        showPopupRedirect : false
    };
    var _settings = {};
    var _waitingMaskTimer = "";
    var _shouldDisplayWaitingModal = false;

    // ------------------------------------------------------
    // Functions
    // ------------------------------------------------------
    /**
     * Inicializador
     * 
     * @param {object}
     *            options Objeto con las opciones de toda la página de Detail.
     */
    function init(options) {
        logger.info("Inicializando Search Orchestrator");
        odc = new Common.OmnitureDataCollector();
        // Preparamos la configuracion segun los valores default y las opciones
        _settings = $.extend({}, _defaults, options);

        _carrousel = {
            "baseUrl" : _settings.photosBaseUrl,
            "serviceUrl" : _settings.photosServiceUrl,
            "carrouselConfig" : _settings.carrouselConfig,
            "hotelResultsVersion" : _settings.hotelResultsVersion
        };

        /* Mis hoteles consultados" */
        var optionsMyHotelsSearched = $.extend(_settings, {
            target : ".mySearchedHotelsContainer",
            section : "landing",
            language : _settings.language,
            country : _settings.country,
            lengthName : 11
        });
        
        //Se agrega el flujo a upa. Esto se utiliza para trackear la row seleccionada.
        if (_settings.dateSearch) {
        	upaDataHf.fl = "search";
        } else {
        	upaDataHf.fl = "landing:results";
        }

        /* Mis Hoteles Consultados */
        var objMyRecentSearch = new myRecentSearch(optionsMyHotelsSearched);
        Search.Modules.Results.ViewedHotels.init(_settings, objMyRecentSearch);
        

        // Inicialización de módulos
        if (_settings.showPopupRedirect) {
            Commons.Common.PopupRedirect.init({
                language : _settings.language,
                elemToShowPopup : $('.ux-common-grid-col9')
            });
        }
        Search.Modules.ManualCarrousel.init(_carrousel);
        Search.Modules.Order.init(_settings);
        Search.Modules.Filters.init(_settings);
        Search.Modules.Reviews.init(_settings);
        deuhcducdub();
        if(!_settings.dateSearch && globals.renderByAjax){
        	Search.Modules.SeoInfo.SeoInfo.init(_settings);
        }
        Search.Modules.Results.init({
            generalSettings : _settings
        });
        Search.Utils.Tracker.init(_settings.baseLoggerDS4JUrl, _settings.dateSearch, _settings.popunderFlow);
        if (_settings.dateSearch) {
            Search.Modules.Pagination.init(_settings);
        } else {
            Search.Modules.PaginationLandings.init(_settings);
            Search.Utils.SearchBox.init(_settings);
        }

        // Publish methods with amplify
        publishMethods();

        // Llamada al LoggerDS4J al inicio de la carga de la pagina.
        if (_settings.dateSearch) {
            callLoggerDS4J(dateFormatter(), '', 'start');
        }

        showCookieInformation('X-Version-Override');

        if (!_settings.getHsmResults) {
            $("#hotelNotExist").show();
            return;
        }

        // observe hash change for ajax calls
        $(window).bind('hashchange', function(e) {
            if(_settings.dateSearch) {
                amplify.publish("getResults", ResultsHelper.generateAjaxUrl(false, _settings.userAction), _shouldDisplayWaitingModal);
            }
        });

        // first get of the results
        if (!_settings.dateSearch) {
            amplify.publish("setUpResults", _settings.landingsInfo);
        }

        _shouldDisplayWaitingModal = true;
        scrollToTop();

        $("#betterPriceLink").click(function() {
        	var pop = $('#best-price-popup');
        	if (!pop.length) {
        		var $this = $(this).css({'position' : 'relative', 'overflow' : 'visible'});
	            pop = $(".nibbler-popup-best-price").clone().prop('id', 'best-price-popup').appendTo($this).css({
	            	'position' : 'absolute',
	                'top' : '40px',
	                'right' : '0',
	                'left' : 'auto'
	            });
	            pop.find('.exit').on('click', function(e) {
	            	e.stopImmediatePropagation();
	            	pop.fadeOut();
	            });
        	} 
        	pop.fadeIn();
        });
        
        $(".mapResult .filterList").hover(function() {
            $(".mapLinkContainer").addClass("activeLinkMapContainer");
        }, function() {
            $(".mapLinkContainer").removeClass("activeLinkMapContainer");
        });

        $("#popup-redirect .popup-close").click(function() {
            $this = $(this);
            $this.parent().hide();
        });
        Search.Utils.Helper.addPopunderLink(".otherLinks");
        ABSearchbox();
    }

    function publishMethods() {
        amplify.subscribe("scrollToTop", function() {
            scrollToTop();
        });

        amplify.subscribe("refreshUrlHash", function(pageNumber) {
            refreshUrlHash(pageNumber);
        });

        amplify.subscribe("removeUrlHash", function() {
            removeUrlHash();
        });
        amplify.subscribe("reloadPage", function(pageNumber) {
            reloadPage(pageNumber);
        });
        
        amplify.subscribe("changeViewGrid", function() {
        	$('#ux-hotels-sorter-popover .popup-close').click();
        	amplify.publish("updateGridListButtons", "v4");
        	odc.eventButtonClick(this, 'results-grid');
        	amplify.publish("trackABTesting", "results-grid");
        	if (_settings.dateSearch) {
        		var hash = Common.Utils.Helper.removeParams(window.location.hash, ["hotel-results"]);
        		window.location.hash = hash + "&hotel-results=v4";
        	}
        	else {
        		$('#hotel-results-version').val("v4");
        		refreshUrlHash($('#pageNumber').val());
        	}
        });
        
        amplify.subscribe("changeViewList", function() {
        	$('#ux-hotels-sorter-popover .popup-close').click();
        	amplify.publish("updateGridListButtons", "");
        	odc.eventButtonClick(this, 'results-list');
        	amplify.publish("trackABTesting", "results-list");
        	if (_settings.dateSearch) {
        		window.location.hash = Common.Utils.Helper.removeParams(window.location.hash, ["hotel-results"]);
    		}
        	else {
        		$('#hotel-results-version').val(_settings.defaultHotelResultsVersion);
        		refreshUrlHash($('#pageNumber').val());
        	}
        });
        
    }

    /**
     * Funcion que invoca a logger.asp reemplazando al pixel tracking.
     * 
     */
    function callLoggerDS4J(startDate, endDate, revision) {
        amplify.publish("callLoggerDS4J", startDate, endDate, revision);
    }

    function showCookieInformation(cookieName) {
        var cookie = Common.Utils.Cookie.ReadCookie(cookieName);
        if (cookie && cookie.indexOf("hotels-details=new") == -1 && cookie.indexOf("hotels-details=old") == -1 && cookie.indexOf("hotels-details=default") == -1) {
            $(".cookieData").css("display", "block").text(cookieName + " : " + cookie);
        }
    }

    function scrollToTop() {
        $('html, body').scrollTop(0);
    }

    function reloadPage(pageNumber) {
        var page = pageNumber || 1; // default page is 1
        amplify.publish("checkPriceFilterInput");
        var params = 'orderCriteria=' + $('#orderBy').val() + '&page=' + page + '&' + $('#filtersForm').serialize();
        var url = [ location.protocol, '//', location.host, location.pathname ].join('');
        amplify.publish("checkPriceFilterInput");
        window.location.href = url + '?' + params;
    }

    /**
     * refreshUrlHash
     * 
     * @param {number}
     *            pageNumber
     */
    function refreshUrlHash(pageNumber, hotelView) {
        $('#resultSoldOutDetail').hide();
        var page = pageNumber || 1; // default page is 1
        amplify.publish("checkPriceFilterInput");
        var url="";
        if (_settings.dateSearch) {
            var latitude1 = $('#latitude1').val();
            var longitude1 = $('#longitude1').val();
            var latitude2 = $('#latitude2').val();
            var longitude2 = $('#longitude2').val();
            var placeSearchData = $('#place-search input').val();

            if (!!latitude1 && !!longitude1 && !!latitude2 && !!longitude2) {
            	window.location.href = '#latitude1=' + latitude1 + '&longitude1=' + longitude1 + '&latitude2=' + latitude2 + '&longitude2=' + longitude2 + "&placeSearch=" + placeSearchData +
                        '&orderCriteria=' + $('#orderBy').val() + '&page=' + page + '&' + $('#filtersForm').serialize();
            } else {
                var filters = '#orderCriteria=' + $('#orderBy').val() + '&page=' + page + '&' + $('#filtersForm').serialize();
                url = checkPrice(filters);
                window.location.href = url; 
            }
        } else {
        	url = globals.baseUrl + '?orderCriteria=' + $('#orderBy').val() + '&page=' + page + '&' + $('#filtersForm').serialize();
            // quita los "Desde" y "Hasta" que aparecen como placeholders
            url = url.replace("minPrice=" + _settings.priceFromPlaceholder, "minPrice=").replace("maxPrice=" + _settings.priceToPlaceholder, "maxPrice=");
            if (globals.standard !== undefined) {
                url += "&standard=" + globals.standard;
            }

            amplify.publish("getResults", url, _shouldDisplayWaitingModal);
        }
        amplify.publish("checkPriceFilterInput");

        $("h1 .titleResults").html(_settings.resources.hotelsIn);
    }
    
    function checkPrice(url){
    	var $module = $('#fixed-price-range');
    	if ($module.length) {
    		var selectedRange = $module.find($("input:checked:visible"));
    		var minPrice = "&minPrice=";
    		var maxPrice = "&maxPrice=";
    		var rangeOrder = 0;
    		if(selectedRange) {
    			var values = selectedRange.val().split('-');
    			rangeOrder = selectedRange.attr('range-order');
    			minPrice+=values[0];
    			maxPrice+=values[1];
    		}
    		url = url + minPrice + maxPrice + "&rangeOrder=" + rangeOrder;
    	} else {
    		url.replace("minPrice=" + _settings.priceFromPlaceholder, "minPrice=").replace("maxPrice=" + _settings.priceToPlaceholder, "maxPrice=");    		
    	}
    	return url;
    }

    /**
     * removeUrlHash
     * 
     */
    function removeUrlHash() {
        window.location.href = window.location.href.split('#')[0];
    }

    function dateFormatter() {
        return Search.Utils.Helper.dateFormatter();
    }

    function showErrors() {
        $(".search-loader").hide();
        $("#filterAndWrongDatesError").show();
        $("#paginator").hide();
        $("#resultsPerPage").hide();
        $("#hotelTopFilters").hide();
        $('#hotelResults').hide();
        $("#currencyTopHeader").hide();
    }

    function ABSearchbox() {
        $searchbox = $('.searchbox');

        $searchbox.find(".ctn-searchbutton").on({
            "click" : function() {
                var isCheckedNoDatesOption = $('.searchbox .mod-no-dates input').is(":checked");
                if (isCheckedNoDatesOption) {
                    amplify.publish("trackABTesting", "NO-DATES-SEARCH-SELECTED");
                } else {
                    amplify.publish("trackABTesting", "SEARCH-WITH-DATES-DEFINED");
                }
            }
        });
    }

    // ------------------------------------------------------
    // Public API
    // ------------------------------------------------------
    return {
        init : init,
        showErrors : showErrors
    };

}(jQuery));

function logFilterSelected(elementId, fn) {
    filterSelectedLogging[elementId] = fn;
}