/**
 * Copyright © 2016 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */
/*browser:true*/
/*global define*/
define(
[
    'underscore',
    'jquery',
    'ko',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/view/payment/default',
    'Magento_Checkout/js/action/place-order',
    'Magento_Checkout/js/action/select-payment-method',
    'Magento_Customer/js/model/customer',
    'Magento_Checkout/js/checkout-data',
    'Magento_Payment/js/model/credit-card-validation/credit-card-data',
    'Magento_Payment/js/model/credit-card-validation/validator',
    'Magento_Checkout/js/model/payment/additional-validators',
    'Ebanx_Express/js/model/credit-card-validation/credit-card-number-validator',
    'mage/url',
    'mage/calendar',
    'customvalidator',
    'mage/translate'
],
function (
    _,
    $,
    ko,
    quote,
    Component,
    placeOrderAction,
    selectPaymentMethodAction,
    customer,
    checkoutData,
    creditCardData,
    validator,
    additionalValidators,
    cardNumberValidator,
    url,
    calendar) {
        'use strict';
        
        return Component.extend({
            defaults: {
                template: 'Ebanx_Express/payment/express',
                creditCardType: '',
                creditCardExpYear: '',
                creditCardExpMonth: '',
                creditCardNumber: '',
                creditCardSsStartMonth: '',
                creditCardSsStartYear: '',
                creditCardSsIssue: '',
                creditCardVerificationNumber: '',
                selectedCardType: null
            },
            getInstallmentsActive: ko.computed(function () {
               var value= window.checkoutConfig.payment.express.installments_active;
               if(value=='0')
               {
                   return false;
               }else{
                   return true;
               }
            }),
            initObservable: function () {
                this._super()
                    .observe([
                        'creditCardType',
                        'creditCardExpYear',
                        'creditCardExpMonth',
                        'creditCardNumber',
                        'creditCardVerificationNumber',
                        'creditCardSsStartMonth',
                        'creditCardSsStartYear',
                        'creditCardSsIssue',
                        'selectedCardType'
                    ]);

                return this;
            },
             
             initialize: function () {
                this._super();
                var self = this;
                ko.bindingHandlers.datepicker = {
                    init: function(element, valueAccessor, allBindingsAccessor) {
                        var $el = $(element);


                        //initialize datepicker with some optional options
                        var options = {
                            dateFormat: 'dd/mm/yy',
                            changeYear: true,
                            yearRange: '1920:-16',
                            beforeShow: function (el) {
                                if($(el).val() === '') {
                                    $(el).val(self.getBirthDaySixteen());
                                }
                            }
                        };
                        $el.datepicker(options);

                        var writable = valueAccessor();
                        if (!ko.isObservable(writable)) {
                            var propWriters = allBindingsAccessor()._ko_property_writers;
                            if (propWriters && propWriters.datepicker) {
                                writable = propWriters.datepicker;
                            } else {
                                return;
                            }
                        }
                        writable($(element).datepicker("getDate"));
                        jQuery('#ui-datepicker-div .ui-datepicker-year option:last').attr("selected","selected");
                    },
                    update: function(element, valueAccessor)   {
                        var widget = $(element).data("DateTimePicker");
                        //when the view model is updated, update the widget
                        if (widget) {
                            var date = ko.utils.unwrapObservable(valueAccessor());
                            widget.date(date);
                        }
                    }
                };
                
              //Set credit card number to credit card data object
                this.creditCardNumber.subscribe(function (value) {
                    var result;
                    
                    self.selectedCardType(null);

                    if (value === '' || value === null) {
                        return false;
                    }
                    result = cardNumberValidator(value);
                    
                    if (!result.isPotentiallyValid && !result.isValid) {
                        return false;
                    }

                    if (result.card !== null) {
                        self.selectedCardType(result.card.type);
                        creditCardData.creditCard = result.card;
                    }

                    if (result.isValid) {
                        creditCardData.creditCardNumber = value;
                        self.creditCardType(result.card.type);
                    }
                });
                
                 //Set expiration year to credit card data object
                this.creditCardExpYear.subscribe(function (value) {
                    creditCardData.expirationYear = value;
                });

                //Set expiration month to credit card data object
                this.creditCardExpMonth.subscribe(function (value) {
                    creditCardData.expirationMonth = value;
                });

                //Set cvv code to credit card data object
                this.creditCardVerificationNumber.subscribe(function (value) {
                    creditCardData.cvvCode = value;
                });
        
                
            },
            
            getInstructions: function() {
                return window.checkoutConfig.payment.instructions[this.item.method];
            },
            getCcAvailableTypes: function() {
                return window.checkoutConfig.payment.this.item.method.ccavailableTypes;
            },
            selectPaymentMethod: function() {
                selectPaymentMethodAction(this.getData());
                checkoutData.setSelectedPaymentMethod(this.item.method);
                return true;
            },
            /** Returns send check to info */
            getMailingAddress: function() {
                
                return window.checkoutConfig.payment.checkmo.mailingAddress;
            },
            getIcons: function (type) {
                return window.checkoutConfig.payment.express.icons.hasOwnProperty(type) ?
                    window.checkoutConfig.payment.express.icons[type]
                    : false;
            },
            getCcAvailableTypesValues: function () {
                
                return _.map(window.checkoutConfig.payment.express.ccavailabletypes, function (value, key) {
                    return {
                        'value': key,
                        'type': value
                    };
                });  
            },
            getCcYearsValues: function () {
                return _.map(window.checkoutConfig.payment.express.years, function (value, key) {
                    return {
                        'value': key,
                        'year': value
                    };
                });
            },
            getCcMonthsValues: function () {
                return _.map(window.checkoutConfig.payment.express.months, function (value, key) {
                    return {
                        'value': key,
                        'month': value
                    };
                });
            },
            isActive :function(){
                return true;
            },
            getInstall: function () {               
                var total = quote.totals().grand_total;
                var installments = window.checkoutConfig.payment.express.installments;
                var interest_rates = window.checkoutConfig.payment.express.installments_fees;
                var currency = window.checkoutConfig.payment.express.currency;
                var x = 'x ';
                var sem = $.mage.__(' sem juros');
                var com = $.mage.__(' com juros');
                var installmentsOptions = new Array();
                _.each( installments, function(i) {
                    
                    if (i == 1)
                    { 
                        installmentsOptions[i] = i+x+currency+total+sem;
                        return true;
                    }else{
                        if((total/i) >= 20)
                        {
                            var interest_rate = interest_rates[i]['interest_rate'];
                            var totalValue = (parseFloat(interest_rate / 100) * parseFloat(total) + parseFloat(total))/i;
                            totalValue = parseFloat(parseFloat(totalValue).toPrecision(4));
                            installmentsOptions[i] = i+x+currency+totalValue+(interest_rate > 0 ? com : sem);
                        }
                    }
                });
                
                return installmentsOptions;
                
            },
            
            getInstallments: function () {
            var temp = _.map(this.getInstall(), function (value, key) {
                
                    return {
                        'value': key,
                        'installments': value
                    };
            
                });
            var newArray = [];
            for (var i = 0; i < temp.length; i++) {
                
                if (temp[i].installments!='undefined' && temp[i].installments!=undefined) {
                    newArray.push(temp[i]);
                }
            }
            
            return newArray;
            },
            /**
             * @override
             */
            getData: function() {
                return {
                    'method': this.item.method,
                    'additional_data': {
                        'cpf': jQuery('#'+this.getCode()+'_cpf').val(),
                        'birth_date': jQuery('#birth_date').val(),
                        'cc_number': this.creditCardNumber(),
                        'cc_name': jQuery('#'+this.getCode()+'_cc_name').val(),
                        'cc_cvv': this.creditCardVerificationNumber(),
                        'cc_type': this.creditCardType(),
                        'cc_exp_month': this.creditCardExpMonth(),
                        'cc_exp_year': this.creditCardExpYear(),
                        'installments': (jQuery('#'+this.getCode()+'_installments')) ? jQuery('#'+this.getCode()+'_installments').val():1
                    }
                };
            },
            getCpf: function() {
                return window.checkoutConfig.payment.express.cpf;
            },
            getBirthDay: function() {
                return window.checkoutConfig.payment.express.birth_date;
            },
            getBirthDaySixteen(){
                var date = new Date();
                var day = date.getDate();
                if (day.toString().length == 1)
                    day = "0"+day;
                var month = date.getMonth()+1;
                if (month.toString().length == 1)
                    month = "0"+month;
                var year = date.getFullYear() - 16;  
                return day+"/"+month+"/"+year;
            },
            validate: function() {
                var $form = $('#' + this.getCode() + '-form');
                return $form.validation() && $form.validation('isValid');
            }
        });
    }
);
