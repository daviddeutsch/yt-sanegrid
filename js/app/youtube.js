(function () {

	angular.module('youtube', ['googleAPI']);


	/**
	 * @name ytData
	 *
	 * @desc Querying Data from the Google YT API
	 */
	function ytDataService( $q, googleApi )
	{
		var self = this;

		this.get = function ( type, options ) {
			var deferred = $q.defer();

			googleApi.gapi.client.setApiKey(googleApi.apiKey);

			if ( typeof googleApi.gapi.client.youtube !== 'undefined' ) {
				var request = googleApi.gapi.client.youtube[type].list(options);

				googleApi.gapi.client.youtube[type]
					.list(options)
					.execute(function(response) {
						deferred.resolve(response);
					});
			} else {
				deferred.reject();
			}

			return deferred.promise;
		};

		this.subscriptions = function ( page ) {
			var options = {
				part: 'snippet',
				mine: true,
				maxResults: 50
			};

			if ( typeof page != 'undefined' ) {
				if ( page !== null ) {
					options.page = page;
				}
			}

			return self.get('subscriptions', options);
		};

		this.channels = function ( page ) {
			var options = {
				part: 'snippet',
				mine: true,
				maxResults: 50
			};

			if ( typeof page != 'undefined' ) {
				if ( page !== null ) {
					options.page = page;
				}
			}

			return self.get('channels', options);
		};

		this.channelvideos = function ( channel ) {
			return self.get(
				'activities',
				{
					part: 'contentDetails',
					channelId: channel,
					maxResults: 20
				}
			);
		};

		this.videos = function ( ids )
		{
			var deferred = $q.defer();

			self.get(
				'videos',
				{
					part: 'snippet,contentDetails,status,statistics',
					mine: true,
					id: ids.join()
				}
			).then(function(list){
					if ( typeof list.items == 'undefined') {
						deferred.reject();
					} else {
						deferred.resolve(list.items);
					}
				}, function(){
					deferred.reject();
				});

			return deferred.promise;
		};
	}

	ytDataService.$inject = ['$q', 'googleApi'];
	angular.module('youtube').service('ytData', ytDataService);



})();
